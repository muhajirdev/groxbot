import type { EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import type { Auth } from "@groxbot/auth";
import type {
  ComputerDownload,
  ComputerFile,
  ComputerList,
} from "@groxbot/contracts";
import type { GuestHub, KnowledgeDisk } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import type { Env } from "./env.js";
import type { KnowledgeAccess } from "./knowledge.js";

export type ComputerAccess = {
  list(botId: string, path: string): Promise<ComputerList>;
  read(botId: string, path: string): Promise<ComputerFile>;
  download(botId: string, path: string): Promise<ComputerDownload>;
  write?(
    botId: string,
    filename: string,
    content: string,
    mediaType?: string,
  ): Promise<{ path: string; size: number }>;
};

export interface RpcContext {
  env: Env;
  db: Database;
  auth: Auth;
  enqueue: EnqueueJob;
  initApp: InitApp;
  guests: GuestHub;
  computer?: ComputerAccess;
  knowledge?: KnowledgeAccess;
  /** Profile photos. Same R2 bucket as knowledge, `_avatars/` prefix — not the office tree. */
  avatars?: KnowledgeDisk;
  /** Live MCP client on a bot actor. Optional in local tests. */
  mcp?: {
    add(
      botId: string,
      input: {
        serverId: string;
        name: string;
        url: string;
        callbackHost: string;
      },
    ): Promise<{ id: string; state: string; authUrl?: string }>;
    remove(botId: string, serverId: string): Promise<void>;
    oauth(botId: string, request: Request): Promise<Response>;
  };
  /** Wipe this bot’s Think Durable Object. Optional in local tests. */
  forgetBot?: (botId: string) => Promise<void>;
  headers?: Headers;
}
