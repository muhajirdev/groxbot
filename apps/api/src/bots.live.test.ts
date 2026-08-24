import { ScriptedAgentRuntime } from "@groxbot/adapters/edge";
import { createWakeHandlers } from "@groxbot/core";
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
    sandboxProvider: "fake",
    agentRuntime: "scripted",
    production: false,
    wakeupKind: "in-process",
  };

  let handles: AppHandles;
  let cookie = "";

  beforeAll(async () => {
    const { db, close } = createDb(databaseUrl);
    handles = createApp(env, { db, close });
    await handles.wakeup.start(
      createWakeHandlers({
        db: handles.db,
        runtime: new ScriptedAgentRuntime(),
        wakeup: handles.wakeup,
        guests: handles.guests,
        appStore: handles.appStore,
      }),
    );
  });

  afterAll(async () => {
    await handles.close();
  });

  function client() {
    return createGroxbotClient({
      baseUrl: origin,
      headers: () => ({ cookie, origin }),
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

    const nameless = await rpc.bots.create({ name: "Scout" });
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

    const desk = await rpc.computer.status({ botId: bot.id });
    expect(desk.files.some((file) => file.path === "/workspace")).toBe(true);
    expect(desk.artifact?.body).toMatch(/Echo:/);
    expect(
      desk.files.some(
        (file) => file.kind === "file" && file.body?.includes("Echo:"),
      ),
    ).toBe(true);

    const taken = await rpc.computer.takeover({ botId: bot.id });
    expect(taken.controlHolder).toBe("user");
    expect(taken.name).toBe("Default computer");
    expect(taken.isDefault).toBe(true);
    const released = await rpc.computer.release({ botId: bot.id });
    expect(released.controlHolder).toBe("bot");
  }, 15_000);

  it("lets two bots share the default computer and isolates a new computer", async () => {
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
    await rpc.workspaces.create({ name: "Desk office" });
    const piper = await rpc.bots.create({
      name: "Piper",
      title: "Product",
      description: "Share the desk.",
      instructions: "Share the desk.",
    });
    const scout = await rpc.bots.create({
      name: "Scout",
      title: "Talent",
      description: "Same desk.",
      instructions: "Same desk.",
    });
    expect(scout.computerId).toBe(piper.computerId);
    expect(scout.computerName).toBe("Default computer");

    const expense = await rpc.bots.create({
      name: "Expense",
      title: "Finance",
      description: "Private box.",
      instructions: "Private box.",
      computer: "new",
    });
    expect(expense.computerId).not.toBe(piper.computerId);
    expect(expense.computerName).not.toBe("Default computer");

    const desks = await rpc.computers.list();
    expect(desks.some((item) => item.isDefault && item.agentCount === 2)).toBe(
      true,
    );
    expect(desks.some((item) => !item.isDefault && item.agentCount === 1)).toBe(
      true,
    );

    await rpc.threads.send({ botId: piper.id, text: "claim the mouse" });
    const piperDesk = await rpc.computer.status({ botId: piper.id });
    const scoutDesk = await rpc.computer.status({ botId: scout.id });
    expect(piperDesk.id).toBe(scoutDesk.id);
    expect(scoutDesk.teammates.map((item) => item.name).sort()).toEqual(
      ["Piper", "Scout"].sort(),
    );

    const taken = await rpc.computer.takeover({ botId: piper.id });
    expect(taken.controlHolder).toBe("user");
    const scoutSees = await rpc.computer.status({ botId: scout.id });
    expect(scoutSees.controlHolder).toBe("user");
    expect(scoutSees.id).toBe(taken.id);
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

    const desks = await rpc.computers.list();
    expect(desks.some((item) => item.isDefault && item.agentCount === 1)).toBe(
      true,
    );
    const piperDesk = await rpc.computer.status({ botId: piper.id });
    expect(piperDesk.teammates.map((item) => item.name)).toEqual(["Piper"]);

    const restored = await rpc.bots.unarchive({ botId: scout.id });
    expect(restored.archivedAt).toBeNull();
    const sent = await rpc.threads.send({
      botId: scout.id,
      text: "back to work",
    });
    expect(sent.seq).toBeGreaterThan(0);

    const after = await rpc.computers.list();
    expect(after.some((item) => item.isDefault && item.agentCount === 2)).toBe(
      true,
    );
  }, 15_000);

  it("lets a teammate join with an invite", async () => {
    const stamp = Date.now();
    const ownerEmail = `owner-${stamp}@example.com`;
    const memberEmail = `member-${stamp}@example.com`;
    let ownerCookie = "";
    let memberCookie = "";

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
    const invite = await ownerRpc.workspaces.invite({ email: memberEmail });
    expect(invite.email).toBe(memberEmail);
    expect(invite.url).toContain("invite=");

    const memberSignUp = await handles.app.request(
      new Request(`${origin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Member",
          email: memberEmail,
          password: "password1",
        }),
      }),
    );
    memberCookie = cookieHeader(memberSignUp);
    expect(memberSignUp.status, await memberSignUp.text()).toBe(200);

    const memberRpc = createGroxbotClient({
      baseUrl: origin,
      headers: () => ({ cookie: memberCookie, origin }),
      fetch: async (input, init) => {
        const request =
          input instanceof Request ? input : new Request(String(input), init);
        const response = await handles.app.request(request);
        memberCookie = cookieHeader(response, memberCookie);
        return response;
      },
    });
    const pending = await memberRpc.workspaces.invitations();
    expect(pending.some((item) => item.id === invite.id)).toBe(true);
    const joined = await memberRpc.workspaces.join({
      invitationId: invite.url,
    });
    expect(joined.id).toBe(office.id);
    expect(joined.name).toBe("Shared office");
    const me = await memberRpc.me();
    expect(me.needsWorkspace).toBe(false);
    expect(me.workspaceId).toBe(office.id);
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
