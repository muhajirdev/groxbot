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

import { createApp } from "./app.js";
import { agentRuntimeSource, loadEnv } from "./env.js";
import { createDb } from "@groxbot/db/node";

async function main() {
  const env = loadEnv();
  const { db, close } = createDb(env.databaseUrl);
  const handles = createApp(env, { db, close });

  if (!env.workerUrl) {
    const runtime = createAgentRuntime(
      env.agentRuntime,
      agentRuntimeSource(env),
    );
    await handles.wakeup.start(
      createWakeHandlers({
        db: handles.db,
        runtime,
        wakeup: handles.wakeup,
        guests: handles.guests,
        appStore: handles.appStore,
        bindRuntime: (overlay) => bindAgentRuntime(env.agentRuntime, overlay),
        pluginTools: (input) =>
          createPluginTools({
            ...input,
            env: { COMPOSIO_API_KEY: env.composioApiKey },
          }),
      }),
    );
  }

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3100);
  const hostname =
    process.env.LISTEN_HOST ??
    (env.production ? "0.0.0.0" : "127.0.0.1");
  serve({ fetch: handles.app.fetch, port, hostname }, () => {
    console.log(`groxbot api http://${hostname}:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
