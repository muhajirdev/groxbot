import { Session } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  DurableSessionStorage,
  type SessionEntryStore,
} from "./durable-session-storage.js";
import { compactOfficeSession } from "./office-compact.js";
import { appendOfficeUserText } from "./office-session.js";
import { piCompletionsModel, scriptedPiStreamFn } from "./pi-turn.js";

function memoryStore(): SessionEntryStore {
  const entries: import("@earendil-works/pi-agent-core").SessionTreeEntry[] =
    [];
  return {
    async load() {
      return {
        metadata: { id: "room-1", createdAt: "2026-01-01T00:00:00.000Z" },
        entries: [...entries],
      };
    },
    async save(entry) {
      entries.push(entry);
    },
  };
}

const model = piCompletionsModel("test-model");

describe("compactOfficeSession", () => {
  it("skips a short desk", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    await appendOfficeUserText(session, { id: "u1", content: "hello" });
    await expect(
      compactOfficeSession(session, {
        model,
        streamFn: scriptedPiStreamFn("should not run"),
      }),
    ).resolves.toBe(false);
  });

  it("keeps the full log and only sends the summary plus tail to the model", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    for (let i = 0; i < 12; i++) {
      await appendOfficeUserText(session, {
        id: `u${i}`,
        content: `check inbox batch ${i} ${"n".repeat(80)}`,
      });
      await session.appendMessage({
        role: "assistant",
        content: [{ type: "text", text: `digest ${i} ${"a".repeat(80)}` }],
        timestamp: Date.now() + i,
        api: "openai-completions",
        provider: "openai",
        model: "test-model",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
      });
    }
    const before = await session.buildContext();
    const compacted = await compactOfficeSession(session, {
      model,
      streamFn: scriptedPiStreamFn(
        "## Goal\nKeep the inbox current.\n## Next Steps\n1. Check mail",
      ),
      force: true,
      settings: {
        enabled: true,
        reserveTokens: 16,
        keepRecentTokens: 40,
      },
    });
    expect(compacted).toBe(true);
    const after = await session.buildContext();
    expect(after.messages.length).toBeLessThan(before.messages.length);
    expect(
      after.messages.some(
        (row) =>
          row.role === "compactionSummary" ||
          (row.role === "user" &&
            typeof row.content !== "string" &&
            JSON.stringify(row.content).includes("Keep the inbox current")),
      ),
    ).toBe(true);
    const bound = (await session.getEntries()).filter(
      (row) => row.type === "message",
    );
    expect(bound.length).toBeGreaterThan(after.messages.length);
  });

  it("skips compact when pruned tool dumps already fit", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    await appendOfficeUserText(session, { id: "u1", content: "check gmail" });
    await session.appendMessage({
      role: "toolResult",
      toolCallId: "call_old",
      toolName: "code",
      content: [{ type: "text", text: "g".repeat(20_000) }],
      details: { raw: "g".repeat(20_000) },
      isError: false,
      timestamp: Date.now(),
    });
    await appendOfficeUserText(session, { id: "u2", content: "again" });
    let summarized = false;
    const compacted = await compactOfficeSession(session, {
      model,
      contextWindow: 2500,
      settings: {
        enabled: true,
        reserveTokens: 200,
        keepRecentTokens: 40,
      },
      streamFn: (called, context) => {
        summarized = true;
        return scriptedPiStreamFn("should not run")(called, context);
      },
    });
    expect(compacted).toBe(false);
    expect(summarized).toBe(false);
  });
});
