import type { McpConnection, McpConnectResult, McpProbeResult } from "@groxbot/contracts";
import {
  addMcpConnection,
  getMcpConnection,
  getMcpConnectionById,
  listMcpConnections,
  McpError,
  mcpOauthServerId,
  mcpProbeError,
  mcpToolNames,
  mcpVisibleToViewer,
  parseVisibility,
  removeMcpConnection,
  saveMcpConnection,
  setMcpVisibility,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import { mcpCallbackPage } from "./mcp-callback-page.js";
import {
  connectMcpHttp,
  finishMcpHttpOAuth,
  listMcpHttpTools,
} from "./mcp-http.js";
import { requireActor } from "./session.js";

function mapMcpError(error: unknown): never {
  if (error instanceof McpError) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  if (error instanceof ORPCError) throw error;
  if (error instanceof Error && error.message.trim()) {
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  }
  throw error;
}

function callbackHost(env: RpcContext["env"]): string {
  return (env.apiUrl ?? env.webOrigin).replace(/\/$/, "");
}

export async function listMcp(context: RpcContext): Promise<McpConnection[]> {
  const actor = await requireActor(context);
  return listMcpConnections(context.db, actor.workspaceId, actor.userId);
}

export async function addMcp(
  context: RpcContext,
  input: {
    botId?: string;
    name: string;
    url: string;
    visibility?: "private" | "shared";
  },
): Promise<McpConnectResult> {
  const actor = await requireActor(context);
  try {
    const row = await addMcpConnection(context.db, actor, {
      ...input,
      visibility: parseVisibility(input.visibility ?? "shared"),
    });
    return connectMcp(context, { id: row.id, botId: input.botId });
  } catch (error) {
    mapMcpError(error);
  }
}

export async function connectMcp(
  context: RpcContext,
  input: { id: string; botId?: string },
): Promise<McpConnectResult> {
  const actor = await requireActor(context);
  try {
    const existing = await getMcpConnection(
      context.db,
      actor.workspaceId,
      input.id,
    );
    if (!existing || !mcpVisibleToViewer(existing, actor.userId)) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    const result = await connectMcpHttp({
      env: context.env,
      workspaceId: actor.workspaceId,
      id: existing.id,
      url: existing.url,
      callbackHost: callbackHost(context.env),
    });
    const connecting = result.state === "authenticating";
    const connection = await saveMcpConnection(context.db, existing.id, {
      status: connecting ? "connecting" : "connected",
      lastError: null,
    });
    return {
      connection,
      redirectUrl: connecting ? (result.authUrl ?? null) : null,
    };
  } catch (error) {
    try {
      const row = await getMcpConnection(
        context.db,
        actor.workspaceId,
        input.id,
      );
      if (row) {
        await saveMcpConnection(context.db, row.id, {
          status: "error",
          lastError: error instanceof Error ? error.message : "Connect failed",
        });
      }
    } catch {
      // Keep the original error.
    }
    mapMcpError(error);
  }
}

export async function removeMcp(context: RpcContext, id: string) {
  const actor = await requireActor(context);
  try {
    const row = await getMcpConnection(context.db, actor.workspaceId, id);
    if (!row || !mcpVisibleToViewer(row, actor.userId)) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    if (parseVisibility(row.visibility) === "private" && row.userId !== actor.userId) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    await removeMcpConnection(context.db, actor.workspaceId, id);
    return { ok: true as const };
  } catch (error) {
    mapMcpError(error);
  }
}

export async function probeMcp(
  context: RpcContext,
  id: string,
): Promise<McpProbeResult> {
  const actor = await requireActor(context);
  try {
    const row = await getMcpConnection(context.db, actor.workspaceId, id);
    if (!row || !mcpVisibleToViewer(row, actor.userId)) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    try {
      const tools = await listMcpHttpTools({
        env: context.env,
        workspaceId: actor.workspaceId,
        id: row.id,
        url: row.url,
        callbackHost: callbackHost(context.env),
      });
      return { ok: true, tools: mcpToolNames(tools), error: null };
    } catch (error) {
      return { ok: false, tools: [], error: mcpProbeError(error) };
    }
  } catch (error) {
    mapMcpError(error);
  }
}

export async function updateMcp(
  context: RpcContext,
  input: { id: string; visibility: "private" | "shared" },
): Promise<McpConnection> {
  const actor = await requireActor(context);
  try {
    return await setMcpVisibility(context.db, actor, input.id, input.visibility);
  } catch (error) {
    mapMcpError(error);
  }
}

export async function completeMcpOAuth(
  context: Pick<RpcContext, "db" | "env">,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const serverId = mcpOauthServerId(url.searchParams.get("state") ?? undefined);
  if (!serverId) {
    return new Response("Missing OAuth state.", { status: 400 });
  }
  const row = await getMcpConnectionById(context.db, serverId);
  if (!row) {
    return new Response("Unknown MCP server.", { status: 404 });
  }
  try {
    await finishMcpHttpOAuth({
      env: context.env,
      workspaceId: row.workspaceId,
      id: row.id,
      url: row.url,
      callbackHost: callbackHost(context.env),
      searchParams: url.searchParams,
    });
    await saveMcpConnection(context.db, row.id, {
      status: "connected",
      lastError: null,
    });
    return new Response(mcpCallbackPage(context.env.webOrigin), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    try {
      await saveMcpConnection(context.db, row.id, {
        status: "error",
        lastError: message,
      });
    } catch {
      // Still return the callback page.
    }
    return new Response(message, { status: 400 });
  }
}
