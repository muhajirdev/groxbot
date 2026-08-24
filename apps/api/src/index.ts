/** Node self-host entry. Product path is `worker.ts` (`pnpm dev` → wrangler). */
import {
  bindAgentRuntime,
  createAgentRuntime,
  createPluginTools,
} from "@groxbot/adapters";
import { createWakeHandlers } from "@groxbot/core";
import { serve } from "@hono/node-server";
import { loadRootEnv } from "./load-root-env.js";

loadRootEnv();

import { createDb } from "@groxbot/db/node";
import { createApp } from "./app.js";
import { agentRuntimeSource, loadEnv } from "./env.js";

async function main() {
  const env = loadEnv();
  const { db, close } = createDb(env.databaseUrl);
  const runtime = createAgentRuntime(env.agentRuntime, agentRuntimeSource(env));
  let enqueue: (job: {
    botId: string;
    name: string;
    payload: Record<string, unknown>;
  }) => Promise<void> = async () => {};
  const handlers = createWakeHandlers({
    db,
    runtime,
    enqueue: (job) => enqueue(job),
    bindRuntime: (overlay) => bindAgentRuntime(env.agentRuntime, overlay),
    pluginTools: (input) =>
      createPluginTools({
        ...input,
        env: { COMPOSIO_API_KEY: env.composioApiKey },
      }),
  });
  enqueue = async (job) => {
    const handler = handlers[job.name as keyof typeof handlers];
    if (!handler) return;
    void handler({ ...job.payload, botId: job.botId }).catch((error) => {
      console.error("bot actor", job.botId, job.name, error);
    });
  };
  const handles = createApp(env, {
    db,
    close,
    enqueue,
    initApp: async () => {},
  });

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3100);
  const hostname =
    process.env.LISTEN_HOST ?? (env.production ? "0.0.0.0" : "127.0.0.1");
  serve({ fetch: handles.app.fetch, port, hostname }, () => {
    console.log(`groxbot api http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
