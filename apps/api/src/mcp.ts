import type { McpConnection, McpConnectResult } from "@groxbot/contracts";
import {
  addMcpConnection,
  getMcpConnection,
  getMcpConnectionById,
  listMcpConnections,
  McpError,
  mcpOauthServerId,
  removeMcpConnection,
  saveMcpConnection,
  thinkMcpServerId,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import { getBotThread } from "./bots.js";
import type { RpcContext } from "./context.js";
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
  return listMcpConnections(context.db, actor.workspaceId);
}

export async function addMcp(
  context: RpcContext,
  input: { botId: string; name: string; url: string },
): Promise<McpConnectResult> {
  const actor = await requireActor(context);
  try {
    const row = await addMcpConnection(context.db, actor, input);
    return connectMcp(context, { id: row.id, botId: input.botId });
  } catch (error) {
    mapMcpError(error);
  }
}

export async function connectMcp(
  context: RpcContext,
  input: { id: string; botId: string },
): Promise<McpConnectResult> {
  const actor = await requireActor(context);
  try {
    const { bot } = await getBotThread(context, actor, input.botId);
    if (bot.archivedAt) {
      throw new McpError("Unarchive this teammate before connecting MCP.");
    }
    if (!context.mcp) {
      throw new McpError("Remote MCP is only available on the Cloudflare API.");
    }
    const existing = await getMcpConnection(
      context.db,
      actor.workspaceId,
      input.id,
    );
    if (!existing) {
      throw new ORPCError("NOT_FOUND", {
        message: "Add the MCP server first.",
      });
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
      userId: actor.userId,
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
    if (row?.hostBotId && context.mcp) {
      try {
        await context.mcp.remove(row.hostBotId, thinkMcpServerId(row.id));
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
