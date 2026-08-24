import type {
  AppStore,
  SandboxProvider,
  WakeupDriver,
} from "@groxbot/adapter-kit";
import type { Auth } from "@groxbot/auth";
import type { GuestHub } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import type { Env } from "./env.js";

export interface RpcContext {
  env: Env;
  db: Database;
  auth: Auth;
  wakeup: WakeupDriver;
  sandbox: SandboxProvider;
  guests: GuestHub;
  appStore: AppStore;
  headers?: Headers;
}
