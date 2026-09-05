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
  mcpServerId,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import { getMcpHostBot } from "./bots.js";
import type { RpcContext } from "./context.js";
import { requireActor, type Actor } from "./session.js";

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

async function ensureMcpHost(
  context: RpcContext,
  actor: Actor,
  row: { id: string; hostBotId: string | null; visibility: string },
): Promise<string> {
  if (row.hostBotId) return row.hostBotId;
  const bot = await getMcpHostBot(context, actor, undefined);
  await saveMcpConnection(context.db, row.id, { hostBotId: bot.id });
  return bot.id;
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
    const bot = await getMcpHostBot(context, actor, input.botId);
    if (!context.mcp) {
      throw new McpError("Remote MCP is only available on the Cloudflare API.");
    }
    const result = await context.mcp.add(bot.id, {
      serverId: existing.id,
      name: existing.name,
      url: existing.url,
      callbackHost: callbackHost(context.env),
    });
    const connecting = result.state === "authenticating";
    const connection = await saveMcpConnection(context.db, existing.id, {
      status: connecting ? "connecting" : "connected",
      hostBotId: bot.id,
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
    if (row && !mcpVisibleToViewer(row, actor.userId)) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    if (row && parseVisibility(row.visibility) === "private" && row.userId !== actor.userId) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
    }
    if (row?.hostBotId && context.mcp) {
      try {
        await context.mcp.remove(row.hostBotId, mcpServerId(row.id));
      } catch {
        // Catalog still goes away if the actor is already gone.
      }
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
    if (!context.mcp?.probe) {
      throw new McpError("Remote MCP is only available on the Cloudflare API.");
    }
    const hostBotId = await ensureMcpHost(context, actor, row);
    try {
      const tools = await context.mcp.probe(
        hostBotId,
        actor.workspaceId,
        row.id,
      );
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
  context: Pick<RpcContext, "db" | "mcp">,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const serverId = mcpOauthServerId(url.searchParams.get("state") ?? undefined);
  if (!serverId) {
    return new Response("Missing OAuth state.", { status: 400 });
  }
  const row = await getMcpConnectionById(context.db, serverId);
  if (!row?.hostBotId) {
    return new Response("Unknown MCP server.", { status: 404 });
  }
  if (!context.mcp) {
    return new Response("Remote MCP is only available on the Cloudflare API.", {
      status: 501,
    });
  }
  return context.mcp.oauth(row.hostBotId, request);
}
