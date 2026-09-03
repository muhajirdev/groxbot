import type { EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import type { Auth } from "@groxbot/auth";
import type {
  ComputerDownload,
  ComputerFile,
  ComputerList,
  Routine,
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
  /** Recurring jobs on this bot’s Think actor. Optional in local tests. */
  routines?: {
    list(botId: string): Promise<Routine[]>;
    create(
      botId: string,
      input: {
        name: string;
        prompt: string;
        cron: string;
        timezone?: string;
      },
    ): Promise<Routine>;
    pause(botId: string, id: string): Promise<Routine>;
    resume(botId: string, id: string): Promise<Routine>;
    remove(botId: string, id: string): Promise<void>;
    /** Archive side-effect: Think stops firing without wiping the catalog. */
    suspend?(botId: string, suspended: boolean): Promise<void>;
  };
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
