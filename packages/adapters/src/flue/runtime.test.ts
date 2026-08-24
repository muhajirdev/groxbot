import { afterAll, describe, expect, it } from "vitest";
import { createAgentRuntime, FLUE_ECHO_RUNTIME } from "../runtime.js";
import { ECHO_MODEL } from "./echo.js";
import {
  FlueAgentRuntime,
  flueConfigured,
  flueRuntimePoolSize,
  getFlueAgentRuntime,
  resolveFlueModel,
  stopFlueAgentRuntime,
} from "./runtime.js";

const runRequest = {
  botId: "bot-flue",
  threadId: "thread-flue",
  runId: "run-flue-1",
  prompt: "summarize the handoff",
  instructions: "You are Piper.",
  history: [{ role: "user" as const, content: "summarize the handoff" }],
};

const adapterContext = {
  operationId: "op-flue",
  workspaceId: "ws-1",
  userId: "user-1",
  botId: "bot-flue",
  runId: "run-flue-1",
  signal: new AbortController().signal,
};

describe("FlueAgentRuntime", () => {
  afterAll(async () => {
    await stopFlueAgentRuntime();
  });

  it("resolves the echo model without provider keys", () => {
    expect(resolveFlueModel(true, {})).toBe(ECHO_MODEL);
  });

  it("requires GROXBOT_MODEL for live Pi", () => {
    expect(flueConfigured({})).toBe(false);
    expect(flueConfigured({ ANTHROPIC_API_KEY: "sk-ant-test" })).toBe(false);
    expect(
      flueConfigured({ GROXBOT_MODEL: "anthropic/claude-sonnet-4-6" }),
    ).toBe(true);
    expect(
      resolveFlueModel(false, { GROXBOT_MODEL: "anthropic/claude-sonnet-4-6" }),
    ).toBe("anthropic/claude-sonnet-4-6");
  });

  it("errors on the first turn when live flue has no model", async () => {
    const runtime = new FlueAgentRuntime({ env: {} });
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events.some((event) => event.type === "progress")).toBe(true);
    expect(events.at(-1)).toMatchObject({
      type: "error",
      text: expect.stringMatching(/Settings → Models|GROXBOT_MODEL/),
    });
    await runtime.stop();
  });

  it("echoes through the Pi harness with poke mounted", async () => {
    const runtime = createAgentRuntime(FLUE_ECHO_RUNTIME);
    const events = [];
    for await (const event of runtime.run(
      {
        botId: "bot-flue-poke",
        threadId: "thread-flue-poke",
        runId: "run-flue-poke",
        prompt: "summarize the handoff",
        instructions: "You are Piper.",
        history: [{ role: "user", content: "summarize the handoff" }],
        teammates: [{ id: "look", name: "Lookout", title: "Watch" }],
        pokeTeammate: async () => "should not run on echo",
      },
      { ...adapterContext, botId: "bot-flue-poke", runId: "run-flue-poke" },
    )) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "text",
      text: "Echo: summarize the handoff",
    });
  });

  it("echoes through the Pi harness with Composio tools mounted", async () => {
    const runtime = createAgentRuntime(FLUE_ECHO_RUNTIME);
    const events = [];
    for await (const event of runtime.run(
      {
        botId: "bot-flue-plugins",
        threadId: "thread-flue-plugins",
        runId: "run-flue-plugins",
        prompt: "summarize the handoff",
        instructions: "You are Piper.",
        history: [{ role: "user", content: "summarize the handoff" }],
        composioUserId: "groxbot:ws:1",
        pluginToolkits: ["gmail"],
        composioSearch: async () => "should not run on echo",
        composioExecute: async () => "should not run on echo",
      },
      {
        ...adapterContext,
        botId: "bot-flue-plugins",
        runId: "run-flue-plugins",
      },
    )) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "text",
      text: "Echo: summarize the handoff",
    });
  });

  it("echoes through the Pi harness offline", async () => {
    const runtime = createAgentRuntime(FLUE_ECHO_RUNTIME);
    const events = [];
    for await (const event of runtime.run(runRequest, adapterContext)) {
      events.push(event);
    }
    expect(events.some((event) => event.type === "progress")).toBe(true);
    expect(events).toContainEqual({
      type: "text",
      text: "Echo: summarize the handoff",
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      text: "Echo: summarize the handoff",
    });
  });

  it("honors a per-turn model id", async () => {
    const runtime = createAgentRuntime(FLUE_ECHO_RUNTIME);
    const events = [];
    for await (const event of runtime.run(
      { ...runRequest, model: "groxbot-echo/echo" },
      adapterContext,
    )) {
      events.push(event);
    }
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("reuses one Flue runtime and applies later env overlays", async () => {
    await stopFlueAgentRuntime();
    const first = getFlueAgentRuntime(true, { GROXBOT_MODEL: "echo-1" });
    const second = getFlueAgentRuntime(true, { GROXBOT_MODEL: "echo-2" });
    expect(second).toBe(first);
    expect(flueRuntimePoolSize()).toBe(1);
    expect(resolveFlueModel(true, { GROXBOT_MODEL: "ignored" })).toBe(
      ECHO_MODEL,
    );
    await stopFlueAgentRuntime();
    expect(flueRuntimePoolSize()).toBe(0);
  });
});
