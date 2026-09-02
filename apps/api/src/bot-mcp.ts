import { getAgentByName } from "agents";

type ActorBinding = DurableObjectNamespace;

export type McpAddResult = {
  id: string;
  state: string;
  authUrl?: string;
};

/** Live MCP client on this bot’s Think actor. Catalog stays in Postgres. */
export async function addBotMcp(
  actors: ActorBinding,
  botId: string,
  input: {
    serverId: string;
    name: string;
    url: string;
    callbackHost: string;
  },
): Promise<McpAddResult> {
  return callBotMcp<McpAddResult>(actors, botId, "/mcp/add", input);
}

export async function removeBotMcp(
  actors: ActorBinding,
  botId: string,
  serverId: string,
): Promise<void> {
  await callBotMcp(actors, botId, "/mcp/remove", { serverId });
}

export async function oauthBotMcp(
  actors: ActorBinding,
  botId: string,
  request: Request,
): Promise<Response> {
  const stub = await getAgentByName(actors, botId);
  return stub.fetch(request);
}

async function callBotMcp<T>(
  actors: ActorBinding,
  botId: string,
  pathname: string,
  body: Record<string, unknown>,
): Promise<T> {
  const stub = await getAgentByName(actors, botId);
  const response = await stub.fetch(
    new Request(`https://groxbot.internal${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json().catch(() => ({}))) as {
    error?: unknown;
  } & T;
  const message =
    typeof payload.error === "string" ? payload.error : undefined;
  if (!response.ok) {
    throw new Error(message || `mcp ${response.status}`);
  }
  return payload;
}
