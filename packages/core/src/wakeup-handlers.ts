import type { AgentRuntime, EnqueueJob, InitApp } from "@groxbot/adapter-kit";
import type { Database } from "@groxbot/db";
import type { GuestHub } from "./guest-hub.js";
import { continueRun } from "./run-continue.js";

export function createWakeHandlers(opts: {
  db: Database;
  runtime: AgentRuntime;
  enqueue: EnqueueJob;
  guests?: GuestHub;
  initApp?: InitApp;
  env?: NodeJS.ProcessEnv;
  bindRuntime?: (overlay: {
    env: NodeJS.ProcessEnv;
    model: string;
    hosted?: boolean;
  }) => AgentRuntime;
  pluginTools?: (input: { workspaceId: string; toolkits: string[] }) =>
    | {
        search: (query: string) => Promise<string>;
        execute: (
          slug: string,
          args: Record<string, unknown>,
        ) => Promise<string>;
      }
    | undefined;
}) {
  return {
    "run.continue": async (payload: Record<string, unknown>) => {
      const runId = String(payload.runId ?? "");
      if (!runId) return;
      await continueRun({
        db: opts.db,
        runtime: opts.runtime,
        runId,
        env: opts.env,
        guests: opts.guests,
        initApp: opts.initApp,
        bindRuntime: opts.bindRuntime,
        pluginTools: opts.pluginTools,
      });
    },
    "run.abort": async (payload: Record<string, unknown>) => {
      const botId = String(payload.botId ?? "");
      const runId = payload.runId ? String(payload.runId) : undefined;
      const runIds = Array.isArray(payload.runIds)
        ? payload.runIds.map((id) => String(id))
        : runId
          ? [runId]
          : [];
      for (const id of runIds) {
        await opts.runtime.abort(id);
      }
      if (!botId) return;
      if (!opts.guests) return;
      if (runIds.length > 0) {
        for (const id of runIds) opts.guests.abort(botId, id);
      } else {
        opts.guests.abort(botId);
      }
    },
    "guest.drop": async (payload: Record<string, unknown>) => {
      const botId = String(payload.botId ?? "");
      if (botId) opts.guests?.dropBot(botId);
    },
  };
}
