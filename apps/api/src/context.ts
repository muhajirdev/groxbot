import type { EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import type { Auth } from "@groxbot/auth";
import type { ComputerFile, ComputerList } from "@groxbot/contracts";
import type { GuestHub } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import type { Env } from "./env.js";

export type ComputerAccess = {
  list(botId: string, path: string): Promise<ComputerList>;
  read(botId: string, path: string): Promise<ComputerFile>;
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
  headers?: Headers;
}
