/** Node Flue actor. Product wakeup is Durable Object `BotActor` on the API Worker. */
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import type { WakeupJob } from "@groxbot/adapter-kit";
import {
  bindAgentRuntime,
  createAgentRuntime,
  createPluginTools,
  InProcessWakeupDriver,
  resolveAgentRuntimeKind,
} from "@groxbot/adapters";
import { MemoryAppStore } from "@groxbot/app-runtime";
import {
  createWakeHandlers,
  GuestHub,
  handleGuestRequest,
  nodeRequestFrom,
} from "@groxbot/core";
import { createDb } from "@groxbot/db/node";
import { config } from "dotenv";

function loadRootEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) {
      config({ path: candidate, override: false });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
loadRootEnv();

function readJson(
  req: import("node:http").IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const { db } = createDb(databaseUrl);
  const agentRuntime = resolveAgentRuntimeKind(process.env.AGENT_RUNTIME);
  const runtime = createAgentRuntime(agentRuntime);
  const wakeup = new InProcessWakeupDriver();
  const guests = new GuestHub();
  const appStore = new MemoryAppStore();
  await wakeup.start(
    createWakeHandlers({
      db,
      runtime,
      wakeup,
      guests,
      appStore,
      bindRuntime: (overlay) => bindAgentRuntime(agentRuntime, overlay),
      pluginTools: (input) => createPluginTools(input),
    }),
  );

  const port = Number(process.env.WORKER_PORT ?? 3101);
  const server = createServer((req, res) => {
    void (async () => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            wakeup: "in-process",
            runtime: agentRuntime,
          }),
        );
        return;
      }
      if (req.url?.startsWith("/guest")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const request = nodeRequestFrom(req, Buffer.concat(chunks));
        const response = await handleGuestRequest(request, {
          db,
          hub: guests,
          wakeup,
        });
        if (!response) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(response.status, {
          "content-type":
            response.headers.get("content-type") ?? "application/json",
        });
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (req.method === "POST" && req.url === "/wakeup") {
        const body = await readJson(req);
        const botId = String(body.botId ?? "");
        const name = String(body.name ?? "");
        if (!botId || !name) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(
            JSON.stringify({ ok: false, error: "botId and name are required" }),
          );
          return;
        }
        const job: WakeupJob = {
          botId,
          name,
          payload: (body.payload as Record<string, unknown>) ?? {},
          runAt:
            typeof body.runAt === "string" ? new Date(body.runAt) : undefined,
          jobKey: typeof body.jobKey === "string" ? body.jobKey : undefined,
        };
        await wakeup.enqueue(job);
        res.writeHead(202, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    })().catch((error) => {
      console.error(error);
      res.writeHead(500);
      res.end();
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`groxbot worker (bot actors) http://127.0.0.1:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
