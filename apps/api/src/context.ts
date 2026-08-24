import type { EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import type { Auth } from "@groxbot/auth";
import type { GuestHub } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import type { Env } from "./env.js";

export interface RpcContext {
  env: Env;
  db: Database;
  auth: Auth;
  enqueue: EnqueueJob;
  initApp: InitApp;
  guests: GuestHub;
  headers?: Headers;
}
