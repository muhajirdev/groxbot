import type { ComputerDownload, ComputerFile, ComputerList } from "@groxbot/contracts";
import { ComputerFileError, ComputerPathError, ComputerWriteError } from "@groxbot/core";
import { getAgentByName } from "agents";

type ActorBinding = DurableObjectNamespace;

/** Read this bot’s Computer workspace. Cloudflare is the mailbox. */
export async function listBotComputer(
  actors: ActorBinding,
  botId: string,
  path: string,
): Promise<ComputerList> {
  return callBotComputer<ComputerList>(actors, botId, "/workspace/list", {
    path,
  });
}

export async function readBotComputer(
  actors: ActorBinding,
  botId: string,
  path: string,
): Promise<ComputerFile> {
  return callBotComputer<ComputerFile>(actors, botId, "/workspace/read", {
    path,
  });
}

export async function downloadBotComputer(
  actors: ActorBinding,
  botId: string,
  path: string,
): Promise<ComputerDownload> {
  return callBotComputer<ComputerDownload>(
    actors,
    botId,
    "/workspace/download",
    { path },
  );
}

export async function writeBotComputer(
  actors: ActorBinding,
  botId: string,
  filename: string,
  content: string,
  mediaType?: string,
): Promise<{ path: string; size: number }> {
  return callBotComputer(actors, botId, "/workspace/write", {
    filename,
    content,
    mediaType,
  });
}

/** Wipe this bot’s Durable Object SQLite. Storage is gone even if the stub stays. */
export async function destroyBotActor(
  actors: ActorBinding,
  botId: string,
): Promise<void> {
  const stub = await getAgentByName(actors, botId);
  const response = await stub.fetch(
    new Request("https://groxbot.internal/destroy", { method: "POST" }),
  );
  if (!response.ok) {
    throw new Error(`forget ${response.status}`);
  }
}

async function callBotComputer<T>(
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
  if (response.status === 400) {
    if (pathname === "/workspace/write") {
      throw new ComputerWriteError(message);
    }
    throw new ComputerPathError(message);
  }
  if (response.status === 404) {
    throw new ComputerFileError(message);
  }
  if (!response.ok) {
    throw new Error(`computer ${response.status}`);
  }
  return payload;
}
