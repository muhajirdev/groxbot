import { ScriptedAgentRuntime } from "@groxbot/adapters/edge";
import { IN_PROCESS_WAKEUP, WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import {
  type ComputerDisk,
  createWakeHandlers,
  decodeComputerBytes,
  downloadComputerFile,
  type KnowledgeDisk,
  listComputerEntries,
  MemoryRoutineStore,
  readComputerFile,
  toRoutineDto,
  writeInboxFile,
} from "@groxbot/core";
import { createDb } from "@groxbot/db/node";
import { createGroxbotClient } from "@groxbot/rpc";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppHandles, createApp } from "./app.js";
import type { Env } from "./env.js";
import { loadRootEnv } from "./load-root-env.js";

loadRootEnv();

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://groxbot:groxbot@127.0.0.1:5433/groxbot";

let dbUp = false;
try {
  const { client } = createDb(databaseUrl);
  await client`select 1`;
  await client.end({ timeout: 2 });
  dbUp = true;
} catch {
  dbUp = false;
}

const origin = "http://127.0.0.1:5173";

class MemoryAvatarDisk implements KnowledgeDisk {
  private readonly files = new Map<string, Uint8Array>();

  async list(prefix: string) {
    return [...this.files.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, bytes]) => ({ key, size: bytes.byteLength }));
  }

  async getText(key: string) {
    const bytes = this.files.get(key);
    return bytes ? new TextDecoder().decode(bytes) : null;
  }

  async getBytes(key: string) {
    return this.files.get(key) ?? null;
  }

  async put(key: string, content: string | Uint8Array) {
    this.files.set(
      key,
      typeof content === "string" ? new TextEncoder().encode(content) : content,
    );
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}

const computerHomes = new Map<string, Map<string, string>>();

function diskFor(botId: string): MapDisk {
  let files = computerHomes.get(botId);
  if (!files) {
    files = new Map();
    computerHomes.set(botId, files);
  }
  return new MapDisk(files);
}

class MapDisk implements ComputerDisk {
  constructor(private readonly files: Map<string, string>) {}

  async readFile(path: string) {
    return this.files.get(path) ?? null;
  }

  async glob(pattern: string) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `^${escaped.replace(/\*\*/g, ":::").replace(/\*/g, "[^/]+").replace(/:::/g, ".*")}$`,
    );
    return [...this.files.keys()].filter((path) => re.test(path)).sort();
  }

  async readDir(path: string) {
    const prefix = path && path !== "." ? `${path}/` : "";
    const names = new Map<string, string>();
    for (const file of this.files.keys()) {
      if (prefix && !file.startsWith(prefix)) continue;
      const rest = prefix ? file.slice(prefix.length) : file;
      if (!rest) continue;
      const cut = rest.indexOf("/");
      if (cut === -1) names.set(rest, "file");
      else names.set(rest.slice(0, cut), "directory");
    }
    return [...names.entries()].map(([name, type]) => ({ path: name, type }));
  }

  async writeFile(path: string, content: string) {
    this.files.set(path, content);
  }
}

function seedComputer(botId: string, files: Record<string, string>) {
  computerHomes.set(botId, new Map(Object.entries(files)));
}

function cookieHeader(response: Response, previous = ""): string {
  const jar = new Map<string, string>();
  for (const part of previous.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name && rest.length) jar.set(name, rest.join("="));
  }
  for (const line of response.headers.getSetCookie()) {
    const pair = line.split(";", 1)[0];
    if (!pair) continue;
    const [name, ...rest] = pair.split("=");
    if (name) jar.set(name.trim(), rest.join("="));
  }
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

describe.skipIf(!dbUp)("bot thread loop", () => {
  const env: Env = {
    databaseUrl,
    authSecret: "development-only-change-me-please-32ch",
    authUrl: origin,
    webOrigin: origin,
    corsOrigins: [origin],
    hostedAiBinding: true,
    production: false,
    wakeupKind: IN_PROCESS_WAKEUP,
    apiUrl: origin,
  };

  let handles: AppHandles;
  let cookie = "";
  const routineStore = new MemoryRoutineStore();

  beforeAll(async () => {
    const { db, close } = createDb(databaseUrl);
    const runtime = new ScriptedAgentRuntime();
    let handlers: ReturnType<typeof createWakeHandlers> | undefined;
    const enqueue = async (job: {
      botId: string;
      name: string;
      payload: Record<string, unknown>;
    }) => {
      const handler =
        handlers?.[job.name as keyof NonNullable<typeof handlers>];
      if (!handler) return;
      void handler({ ...job.payload, botId: job.botId }).catch((error) => {
        console.error("bot actor", job.botId, job.name, error);
      });
    };
    handles = createApp(env, {
      db,
      close,
      enqueue,
      initApp: async () => {},
      computer: {
        list: (botId, path) => listComputerEntries(diskFor(botId), path),
        read: (botId, path) => readComputerFile(diskFor(botId), path),
        download: (botId, path) => downloadComputerFile(diskFor(botId), path),
        write: (botId, filename, content) =>
          writeInboxFile(
            diskFor(botId),
            filename,
            decodeComputerBytes(content),
          ),
      },
      avatars: new MemoryAvatarDisk(),
      routines: {
        list: async (botId) =>
          routineStore.list(botId).map((row) => toRoutineDto(botId, row)),
        create: async (botId, input) =>
          toRoutineDto(botId, routineStore.create(botId, input)),
        pause: async (botId, id) =>
          toRoutineDto(botId, routineStore.setActive(botId, id, false)),
        resume: async (botId, id) =>
          toRoutineDto(botId, routineStore.setActive(botId, id, true)),
        remove: async (botId, id) => {
          routineStore.remove(botId, id);
        },
        suspend: async () => {},
      },
    });
    handlers = createWakeHandlers({
      db,
      runtime,
      enqueue,
      guests: handles.guests,
      initApp: async () => {},
    });
  });

  afterAll(async () => {
    await handles.close();
  });

  function client(workspaceId?: string) {
    return createGroxbotClient({
      baseUrl: origin,
      headers: () => ({
        cookie,
        origin,
        ...(workspaceId ? { [WORKSPACE_ID_HEADER]: workspaceId } : {}),
      }),
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        const response = await handles.app.request(request);
        cookie = cookieHeader(response, cookie);
        return response;
      },
    });
  }

  it("signs up, hires a bot, and echoes a message", async () => {
    const email = `loop-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);
    expect(cookie).toContain("session");

    const rpc = client();
    const me = await rpc.me();
    expect(me.email).toBe(email);
    expect(me.needsWorkspace).toBe(true);
    expect(me.workspaceId).toBeNull();
    await expect(rpc.bots.create({ name: "Too soon" })).rejects.toMatchObject({
      code: "FAILED_PRECONDITION",
    });

    const office = await rpc.workspaces.create({ name: "Test office" });
    expect(office.name).toBe("Test office");
    const ready = await rpc.me();
    expect(ready.needsWorkspace).toBe(false);
    expect(ready.workspaceId).toBe(office.id);
    expect(ready.workspaceName).toBe("Test office");

    const bot = await rpc.bots.create({
      name: "Piper",
      title: "Product performance",
      description: "Echo for tests.",
      instructions: "Echo for tests.",
    });
    expect(bot.name).toBe("Piper");

    const namelessId = crypto.randomUUID();
    const nameless = await rpc.bots.create({
      id: namelessId,
      name: "Scout",
    });
    expect(nameless.id).toBe(namelessId);
    expect(nameless.title).toBe("");

    const listed = await rpc.bots.list();
    expect(listed.some((item) => item.id === bot.id)).toBe(true);

    const sent = await rpc.threads.send({
      botId: bot.id,
      text: "summarize the handoff",
    });
    expect(sent.seq).toBeGreaterThan(0);

    const texts: string[] = [];
    const iterator = (await rpc.threads.subscribe({
      botId: bot.id,
      cursor: -1,
    })) as AsyncGenerator<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    const stop = setTimeout(() => void iterator.return(undefined), 8_000);
    try {
      for await (const event of iterator) {
        if (event.type !== "message.created") continue;
        const blocks = event.payload.blocks;
        if (!Array.isArray(blocks)) continue;
        for (const block of blocks) {
          if (
            block &&
            typeof block === "object" &&
            "text" in block &&
            typeof block.text === "string"
          ) {
            texts.push(block.text);
          }
        }
        if (texts.some((text) => text.startsWith("Echo:"))) break;
      }
    } finally {
      clearTimeout(stop);
      await iterator.return(undefined);
    }

    expect(texts).toContain("summarize the handoff");
    expect(texts.some((text) => text.startsWith("Echo:"))).toBe(true);
  }, 15_000);

  it("hires two bots without a shared desk", async () => {
    const email = `desk-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Desk Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    const office = await rpc.workspaces.create({ name: "Desk office" });
    const renamed = await rpc.workspaces.update({ name: "  Desk HQ  " });
    expect(renamed.id).toBe(office.id);
    expect(renamed.name).toBe("Desk HQ");
    expect((await rpc.me()).workspaceName).toBe("Desk HQ");
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Share the desk.",
      instructions: "Share the desk.",
    });
    const scout = await rpc.bots.create({
      name: "Scout",
      title: "Talent",
      description: "Same office.",
      instructions: "Same office.",
    });
    expect(scout.id).not.toBe(piper.id);

    const expense = await rpc.bots.create({
      name: "Expense",
      title: "Finance",
      description: "Another teammate.",
      instructions: "Another teammate.",
    });
    expect(expense.id).not.toBe(piper.id);

    const listed = await rpc.bots.list();
    expect(listed.map((item) => item.name).sort()).toEqual(
      ["Expense", "Piper", "Scout"].sort(),
    );
  }, 15_000);

  it("creates a second office and switches back", async () => {
    cookie = "";
    const email = `offices-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Offices Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    const first = await rpc.workspaces.create({ name: "First office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Home office.",
      instructions: "Home office.",
    });
    const listed = await rpc.workspaces.list();
    expect(listed.map((item) => item.id).sort()).toEqual([first.id]);

    const second = await rpc.workspaces.create({ name: "Second office" });
    expect(second.id).not.toBe(first.id);
    const inSecond = await rpc.me();
    expect(inSecond.workspaceId).toBe(second.id);
    expect(inSecond.workspaceName).toBe("Second office");
    expect(inSecond.workspaceSlug).toBe(second.slug);
    expect(await rpc.bots.list()).toEqual([]);
    expect(
      (await client(first.id).bots.list()).some((bot) => bot.id === piper.id),
    ).toBe(true);
    expect(await rpc.bots.list()).toEqual([]);
    expect((await rpc.workspaces.list()).map((item) => item.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );

    const activated = await rpc.workspaces.activate({
      workspaceId: first.id,
    });
    expect(activated.id).toBe(first.id);
    const home = await rpc.me();
    expect(home.workspaceId).toBe(first.id);
    expect(home.workspaceName).toBe("First office");
    expect((await rpc.bots.list()).some((bot) => bot.id === piper.id)).toBe(
      true,
    );
  }, 15_000);

  it("lists files on this bot's computer", async () => {
    const email = `desk-files-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Files Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Files office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Keep notes.",
      instructions: "Keep notes.",
    });
    seedComputer(piper.id, {
      "memory.md": "office notes",
      "skills/digest/SKILL.md": "write the digest",
    });

    const listed = await rpc.computer.list({ botId: piper.id });
    expect(listed.entries.map((row) => row.path)).toContain("memory.md");
    expect(listed.truncated).toBe(false);
    expect(listed.entries.map((row) => row.path)).toContain(
      "skills/digest/SKILL.md",
    );

    const file = await rpc.computer.read({
      botId: piper.id,
      path: "memory.md",
    });
    expect(file).toMatchObject({
      path: "memory.md",
      content: "office notes",
      encoding: "text",
    });

    await expect(
      rpc.computer.list({ botId: piper.id, path: "../secret" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      rpc.computer.list({ botId: "bot_missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const attached = await rpc.computer.write({
      botId: piper.id,
      filename: "brief.md",
      content: btoa("week one"),
    });
    expect(attached.path).toBe("inbox/brief.md");
    const listedInbox = await rpc.computer.list({ botId: piper.id });
    expect(listedInbox.entries.map((row) => row.path)).toContain(
      "inbox/brief.md",
    );
    const inboxFile = await rpc.computer.read({
      botId: piper.id,
      path: "inbox/brief.md",
    });
    expect(inboxFile.content).toBe("week one");

    const downloaded = await rpc.computer.download({
      botId: piper.id,
      path: "inbox/brief.md",
    });
    expect(downloaded.filename).toBe("brief.md");
    expect(downloaded.mediaType).toBe("text/markdown");
    expect(
      new TextDecoder().decode(decodeComputerBytes(downloaded.content)),
    ).toBe("week one");
  }, 20_000);

  it("creates, pauses, and removes a routine on the bot", async () => {
    const email = `routines-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Routine Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Routine office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Keep notes.",
      instructions: "Keep notes.",
    });

    const created = await rpc.routines.create({
      botId: piper.id,
      name: "Nightly Gmail",
      prompt: "Check overnight mail. Do not send.",
      cron: "0 22 * * *",
    });
    expect(created.cron).toBe("every day at 22:00");
    expect(created.active).toBe(true);

    const listed = await rpc.routines.list({ botId: piper.id });
    expect(listed.map((row) => row.name)).toEqual(["Nightly Gmail"]);

    const paused = await rpc.routines.pause({
      botId: piper.id,
      id: created.id,
    });
    expect(paused.active).toBe(false);
    const resumed = await rpc.routines.resume({
      botId: piper.id,
      id: created.id,
    });
    expect(resumed.active).toBe(true);

    await rpc.routines.remove({ botId: piper.id, id: created.id });
    expect(await rpc.routines.list({ botId: piper.id })).toEqual([]);
  }, 15_000);

  it("lets a guest agent dial in and answer", async () => {
    const email = `guest-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Guest Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Guest office" });
    const bot = await rpc.bots.create({
      name: "Hermes stand-in",
      title: "External",
      description: "Guest loop.",
      instructions: "Guest loop.",
    });
    expect(bot.guestKind).toBe("off");

    const issued = await rpc.guests.enable({
      botId: bot.id,
      kind: "hermes",
    });
    expect(issued.token.startsWith("gbg_")).toBe(true);
    expect(issued.command).toContain("--kind hermes");

    const sent = await rpc.threads.send({
      botId: bot.id,
      text: "ping from office",
    });
    expect(sent.seq).toBeGreaterThan(0);

    const hello = await handles.app.request(
      new Request(`${origin}/guest/hello`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: issued.token, kind: "hermes" }),
      }),
    );
    const helloBody = await hello.text();
    expect(hello.status, helloBody).toBe(200);
    const session = JSON.parse(helloBody) as { sessionId: string };

    let runId = "";
    for (let i = 0; i < 8 && !runId; i += 1) {
      const waited = await handles.app.request(
        new Request(`${origin}/guest/wait`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId }),
        }),
      );
      expect(waited.status).toBe(200);
      const message = (await waited.json()) as {
        type: string;
        request?: { runId: string; prompt: string };
      };
      if (message.type === "run" && message.request) {
        runId = message.request.runId;
        expect(message.request.prompt).toBe("ping from office");
      }
    }
    expect(runId.length).toBeGreaterThan(0);

    const reply = "Guest: ping from office";
    for (const event of [
      { type: "progress", text: "working…" },
      { type: "text", text: reply },
      { type: "done", text: reply },
    ]) {
      const posted = await handles.app.request(
        new Request(`${origin}/guest/event`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: session.sessionId,
            runId,
            event,
          }),
        }),
      );
      expect(posted.status, await posted.text()).toBe(200);
    }

    const texts: string[] = [];
    const iterator = (await rpc.threads.subscribe({
      botId: bot.id,
      cursor: -1,
    })) as AsyncGenerator<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    const stop = setTimeout(() => void iterator.return(undefined), 8_000);
    try {
      for await (const event of iterator) {
        if (event.type !== "message.created") continue;
        const blocks = event.payload.blocks;
        if (!Array.isArray(blocks)) continue;
        for (const block of blocks) {
          if (
            block &&
            typeof block === "object" &&
            "text" in block &&
            typeof block.text === "string"
          ) {
            texts.push(block.text);
          }
        }
        if (texts.includes(reply)) break;
      }
    } finally {
      clearTimeout(stop);
      await iterator.return(undefined);
    }
    expect(texts).toContain("ping from office");
    expect(texts).toContain(reply);

    await rpc.guests.disable({ botId: bot.id });
    const after = await rpc.bots.get({ botId: bot.id });
    expect(after.guestKind).toBe("off");
  }, 20_000);

  it("archives a bot, hides it from the desk, and restores it", async () => {
    cookie = "";
    const email = `archive-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Archive Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Archive office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Stays live.",
      instructions: "Stays live.",
    });
    const scout = await rpc.bots.create({
      name: "Scout",
      title: "Talent",
      description: "Goes to archive.",
      instructions: "Goes to archive.",
    });
    expect(scout.archivedAt).toBeNull();

    const archived = await rpc.bots.archive({ botId: scout.id });
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.id).toBe(scout.id);

    const listed = await rpc.bots.list();
    expect(
      listed.find((item) => item.id === scout.id)?.archivedAt,
    ).toBeTruthy();
    expect(listed.find((item) => item.id === piper.id)?.archivedAt).toBeNull();

    await expect(
      rpc.threads.send({ botId: scout.id, text: "still there?" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    const restored = await rpc.bots.unarchive({ botId: scout.id });
    expect(restored.archivedAt).toBeNull();
    const sent = await rpc.threads.send({
      botId: scout.id,
      text: "back to work",
    });
    expect(sent.seq).toBeGreaterThan(0);

    const after = await rpc.bots.list();
    expect(after.filter((item) => !item.archivedAt)).toHaveLength(2);
  }, 15_000);

  it("pins a bot to the top of the roster", async () => {
    cookie = "";
    const email = `pin-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Pin Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Pin office" });
    const lookout = await rpc.bots.create({
      name: "Lookout",
      title: "Watch",
      description: "Gets pinned.",
      instructions: "Gets pinned.",
    });
    expect(lookout.pinnedAt).toBeNull();

    const pinned = await rpc.bots.pin({ botId: lookout.id });
    expect(pinned.pinnedAt).toBeTruthy();
    expect(pinned.id).toBe(lookout.id);

    const listed = await rpc.bots.list();
    expect(
      listed.find((item) => item.id === lookout.id)?.pinnedAt,
    ).toBeTruthy();

    const again = await rpc.bots.pin({ botId: lookout.id });
    expect(again.pinnedAt).toBe(pinned.pinnedAt);

    const restored = await rpc.bots.unpin({ botId: lookout.id });
    expect(restored.pinnedAt).toBeNull();
  }, 30_000);

  it("groups bots into sidebar sections", async () => {
    cookie = "";
    const email = `section-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Section Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    const office = await rpc.workspaces.create({ name: "Section office" });
    const lookout = await rpc.bots.create({
      name: "Lookout",
      title: "Watch",
      description: "Gets grouped.",
      instructions: "Gets grouped.",
    });
    expect(lookout.sectionId).toBeNull();

    const sales = await rpc.sections.create({ name: "Sales" });
    const ops = await rpc.sections.create({ name: "Ops" });
    const sections = await rpc.sections.list();
    expect(sections.map((row) => row.id)).toEqual([sales.id, ops.id]);
    expect(sales.position).toBeLessThan(ops.position);

    const moved = await rpc.bots.move({
      botId: lookout.id,
      sectionId: sales.id,
    });
    expect(moved.sectionId).toBe(sales.id);
    expect(
      (await rpc.bots.list()).find((item) => item.id === lookout.id)?.sectionId,
    ).toBe(sales.id);

    const ungrouped = await rpc.bots.move({
      botId: lookout.id,
      sectionId: null,
    });
    expect(ungrouped.sectionId).toBeNull();

    await rpc.bots.move({ botId: lookout.id, sectionId: sales.id });
    await rpc.sections.remove({ sectionId: sales.id });
    expect(
      (await rpc.bots.list()).find((item) => item.id === lookout.id)?.sectionId,
    ).toBeNull();

    await rpc.workspaces.create({ name: "Other office" });
    const foreign = await rpc.sections.create({ name: "Foreign" });
    await rpc.workspaces.activate({ workspaceId: office.id });
    await expect(
      rpc.bots.move({ botId: lookout.id, sectionId: foreign.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }, 30_000);

  it("deletes a bot and drops it from the roster", async () => {
    cookie = "";
    const email = `delete-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Delete Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Delete office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Stays.",
      instructions: "Stays.",
    });
    const scout = await rpc.bots.create({
      name: "Scout",
      title: "Talent",
      description: "Gets deleted.",
      instructions: "Gets deleted.",
    });

    const gone = await rpc.bots.delete({ botId: scout.id });
    expect(gone).toEqual({ ok: true });

    const listed = await rpc.bots.list();
    expect(listed.map((item) => item.id)).toEqual([piper.id]);
    await expect(rpc.bots.get({ botId: scout.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      rpc.threads.send({ botId: scout.id, text: "still there?" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(rpc.bots.delete({ botId: scout.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await rpc.bots.delete({ botId: piper.id });
    expect(await rpc.bots.list()).toEqual([]);
  }, 60_000);

  it("deletes a group room and refuses a home office", async () => {
    cookie = "";
    const email = `room-delete-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Room Delete Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Delete room office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Stays.",
      instructions: "Stays.",
      visibility: "shared",
    });
    const scout = await rpc.bots.create({
      name: "Scout",
      title: "Talent",
      description: "Also stays.",
      instructions: "Also stays.",
      visibility: "shared",
    });
    const board = await rpc.rooms.create({
      name: "Board",
      memberBotIds: [piper.id, scout.id],
    });

    const gone = await rpc.rooms.delete({ roomId: board.id });
    expect(gone).toEqual({ ok: true });
    expect((await rpc.rooms.list()).map((item) => item.id)).toEqual([]);
    await expect(rpc.rooms.get({ roomId: board.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(rpc.rooms.delete({ roomId: board.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const homeId = piper.homeRoomId;
    expect(homeId).toBeTruthy();
    await expect(rpc.rooms.delete({ roomId: homeId })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const still = await rpc.bots.get({ botId: piper.id });
    expect(still.homeRoomId).toBe(homeId);
  }, 60_000);

  it("lets a teammate join with an invite", async () => {
    const stamp = Date.now();
    const ownerEmail = `owner-${stamp}@example.com`;
    const memberEmail = `member-${stamp}@example.com`;
    let ownerCookie = "";

    const ownerSignUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Owner",
          email: ownerEmail,
          password: "password1",
        }),
      }),
    );
    ownerCookie = cookieHeader(ownerSignUp);
    expect(ownerSignUp.status, await ownerSignUp.text()).toBe(200);

    const ownerRpc = createGroxbotClient({
      baseUrl: origin,
      headers: () => ({ cookie: ownerCookie, origin }),
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        const response = await handles.app.request(request);
        ownerCookie = cookieHeader(response, ownerCookie);
        return response;
      },
    });
    const office = await ownerRpc.workspaces.create({ name: "Shared office" });
    const roster = await ownerRpc.workspaces.members();
    expect(roster).toHaveLength(1);
    expect(roster[0]?.mine).toBe(true);
    expect(roster[0]?.role).toBe("owner");
    expect(roster[0]?.email).toBe(ownerEmail);

    const renamed = await ownerRpc.account.update({ name: "Office Owner" });
    expect(renamed.name).toBe("Office Owner");
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const photo = await ownerRpc.account.update({
      image: { content: png },
    });
    expect(photo.image).toContain("/avatars/");
    const served = await handles.app.request(
      new URL(photo.image ?? "", origin).pathname,
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    const invite = await ownerRpc.workspaces.invite({ email: memberEmail });
    expect(invite.email).toBe(memberEmail);
    expect(invite.url).toContain("invite=");

    const guestRpc = createGroxbotClient({
      baseUrl: origin,
      headers: () => ({ origin }),
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return handles.app.request(request);
      },
    });
    await expect(
      guestRpc.workspaces.peek({ invitationId: invite.url }),
    ).resolves.toEqual({
      email: memberEmail,
      organizationName: "Shared office",
      organizationId: office.id,
    });
    await expect(
      guestRpc.workspaces.peek({ invitationId: "missing-invite" }),
    ).resolves.toBeNull();

    const guestJoin = await handles.app.request(
      new Request(`${origin}/api/invites/accept`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ invitationId: invite.url }),
      }),
    );
    expect(guestJoin.status, await guestJoin.text()).toBe(200);
    const guestCookie = cookieHeader(guestJoin);
    expect(guestCookie).toContain("=");
    const joinedGuest = createGroxbotClient({
      baseUrl: origin,
      headers: () => ({ cookie: guestCookie, origin }),
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        return handles.app.request(request);
      },
    });
    const joinedMe = await joinedGuest.me();
    expect(joinedMe.needsWorkspace).toBe(false);
    expect(joinedMe.workspaceId).toBe(office.id);
    expect(joinedMe.email).toBe(memberEmail);

    const together = await ownerRpc.workspaces.members();
    expect(together.map((row) => row.email).sort()).toEqual(
      [memberEmail, ownerEmail].sort(),
    );
    expect(together.filter((row) => row.mine)).toHaveLength(1);
  }, 15_000);

  it("lets one bot poke another and brings the reply back", async () => {
    const email = `poke-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Poke Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Poke office" });
    const mayaBot = await rpc.bots.create({
      name: "Maya",
      title: "Chief of Staff",
      description: "Front door.",
      instructions: "Front door.",
    });
    const lookout = await rpc.bots.create({
      name: "Lookout",
      title: "Watch",
      description: "Specialist.",
      instructions: "Specialist.",
    });

    await rpc.threads.send({
      botId: mayaBot.id,
      text: "poke Lookout: summarize the week",
    });

    const maya = await collectOffice(rpc, mayaBot.id, (texts) =>
      texts.some((text) => text.startsWith("Asked Lookout")),
    );
    expect(maya.texts).toContain("poke Lookout: summarize the week");
    expect(maya.texts).toContain("Lookout replied.");
    expect(maya.texts.some((text) => text.startsWith("Asked Lookout"))).toBe(
      true,
    );
    expect(maya.pokeThreadId).toBeTruthy();

    const poke = await rpc.threads.get({ threadId: maya.pokeThreadId ?? "" });
    expect(poke.kind).toBe("poke");
    expect(poke.bots.map((item) => item.name).sort()).toEqual([
      "Lookout",
      "Maya",
    ]);
    const pokeTexts = poke.messages.flatMap((message) =>
      message.blocks.flatMap((block) =>
        block.kind === "text" ? [block.text] : [],
      ),
    );
    expect(
      pokeTexts.some((text) =>
        text.includes("Maya (Chief of Staff) asked you"),
      ),
    ).toBe(true);
    expect(pokeTexts.some((text) => text.startsWith("Echo:"))).toBe(true);

    const lookoutOffice = await collectOffice(rpc, lookout.id, () => true, 800);
    expect(
      lookoutOffice.texts.some((text) =>
        text.includes("Maya (Chief of Staff) asked you"),
      ),
    ).toBe(false);
    expect(lookoutOffice.texts.some((text) => text.startsWith("Echo:"))).toBe(
      false,
    );
  }, 20_000);

  it("stamps a deck when asked to make slides", async () => {
    const email = `apps-${Date.now()}@example.com`;
    const signUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Apps Tester",
          email,
          password: "password1",
        }),
      }),
    );
    cookie = cookieHeader(signUp, cookie);
    expect(signUp.status, await signUp.text()).toBe(200);

    const rpc = client();
    await rpc.workspaces.create({ name: "Apps office" });
    const bot = await rpc.bots.create({ name: "Reja" });
    await rpc.threads.send({
      botId: bot.id,
      text: "make me slides about Q3",
    });

    let appId = "";
    let title = "";
    const iterator = (await rpc.threads.subscribe({
      botId: bot.id,
      cursor: -1,
    })) as AsyncGenerator<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    const stop = setTimeout(() => void iterator.return(undefined), 8_000);
    try {
      for await (const event of iterator) {
        if (event.type !== "message.created") continue;
        const blocks = event.payload.blocks;
        if (!Array.isArray(blocks)) continue;
        for (const block of blocks) {
          if (
            block &&
            typeof block === "object" &&
            "kind" in block &&
            block.kind === "app" &&
            "appId" in block &&
            typeof block.appId === "string"
          ) {
            appId = block.appId;
            title =
              "title" in block && typeof block.title === "string"
                ? block.title
                : "";
          }
        }
        if (appId) break;
      }
    } finally {
      clearTimeout(stop);
      await iterator.return(undefined);
    }

    expect(appId).not.toBe("");
    expect(title).toBe("Q3");
    const listed = await rpc.apps.list();
    expect(listed.some((app) => app.id === appId && app.title === "Q3")).toBe(
      true,
    );
  }, 15_000);
});

async function collectOffice(
  rpc: ReturnType<typeof createGroxbotClient>,
  botId: string,
  done: (texts: string[]) => boolean,
  timeoutMs = 12_000,
): Promise<{ texts: string[]; pokeThreadId: string | null }> {
  const texts: string[] = [];
  let pokeThreadId: string | null = null;
  const iterator = (await rpc.threads.subscribe({
    botId,
    cursor: -1,
  })) as AsyncGenerator<{
    type: string;
    payload: Record<string, unknown>;
  }>;
  const stop = setTimeout(() => void iterator.return(undefined), timeoutMs);
  try {
    for await (const event of iterator) {
      if (event.type !== "message.created") continue;
      const blocks = event.payload.blocks;
      if (!Array.isArray(blocks)) continue;
      for (const block of blocks) {
        if (!block || typeof block !== "object") continue;
        if (
          "kind" in block &&
          block.kind === "text" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          texts.push(block.text);
        }
        if (
          "kind" in block &&
          block.kind === "poke_thread" &&
          "threadId" in block &&
          typeof block.threadId === "string"
        ) {
          pokeThreadId = block.threadId;
        }
      }
      if (done(texts)) break;
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
  } finally {
    clearTimeout(stop);
    await iterator.return(undefined).catch(() => undefined);
  }
  return { texts, pokeThreadId };
}
