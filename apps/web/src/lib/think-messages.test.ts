import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearThinkMessages,
  fetchThinkMessages,
  peekThinkMessages,
  setThinkMessages,
  thinkAgentId,
  thinkMessagesKey,
  thinkMessagesQueryOptions,
} from "./think-messages";
import { queryClient } from "./orpc";

const botId = "bot-cache-test";

afterEach(() => {
  clearThinkMessages();
  vi.unstubAllGlobals();
});

describe("thinkAgentId", () => {
  it("is the Durable Object instance name", () => {
    expect(thinkAgentId("  bot-1  ")).toBe("bot-1");
  });

  it("rejects an empty id", () => {
    expect(() => thinkAgentId(" ")).toThrow(/think agent id/);
  });
});

describe("think messages cache", () => {
  it("round-trips messages in the query client", () => {
    expect(peekThinkMessages(botId)).toBeUndefined();
    const messages = [
      { id: "m1", role: "user" as const, parts: [{ type: "text" as const, text: "hi" }] },
    ];
    setThinkMessages(botId, messages);
    expect(peekThinkMessages(botId)).toEqual(messages);
    expect(queryClient.getQueryData(thinkMessagesKey(botId))).toEqual(messages);
  });

  it("treats an empty thread as cached", () => {
    setThinkMessages(botId, []);
    expect(peekThinkMessages(botId)).toEqual([]);
  });

  it("uses a stable query key for the route loader", () => {
    expect(thinkMessagesQueryOptions(botId).queryKey).toEqual(
      thinkMessagesKey(botId),
    );
  });
});

describe("fetchThinkMessages", () => {
  it("returns null when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    expect(await fetchThinkMessages("http://127.0.0.1/agents/bot-actor/x")).toBe(
      null,
    );
  });

  it("returns [] for an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    expect(await fetchThinkMessages("http://127.0.0.1/agents/bot-actor/x")).toEqual(
      [],
    );
  });
});
