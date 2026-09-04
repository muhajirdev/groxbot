import { Session } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  DurableSessionStorage,
  type SessionEntryStore,
} from "./durable-session-storage.js";
import {
  appendOfficeUserText,
  migrateOfficeChatToSession,
  persistOfficeSessionEvent,
  piBoundFromSessionEntries,
} from "./office-session.js";

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

describe("office session tree", () => {
  it("keeps assistant and toolResult as separate Pi messages", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    await appendOfficeUserText(session, { id: "u1", content: "list files" });
    await persistOfficeSessionEvent(
      session,
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_1",
              name: "list",
              arguments: { path: "/" },
            },
          ],
        },
      } as never,
      "a1",
    );
    await persistOfficeSessionEvent(session, {
      type: "message_end",
      message: {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "list",
        content: [{ type: "text", text: "[]" }],
        details: { entries: [] },
        isError: false,
        timestamp: Date.now(),
      },
    } as never);
    await persistOfficeSessionEvent(session, {
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Empty desk." }],
      },
    } as never);

    const bound = piBoundFromSessionEntries(await session.getBranch());
    expect(bound.map((row) => row.message.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
    expect(bound[2]?.message).toMatchObject({
      role: "toolResult",
      toolCallId: "call_1",
    });
  });

  it("branches on regenerate instead of rewriting the trunk", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    await appendOfficeUserText(session, { id: "u1", content: "hi" });
    await persistOfficeSessionEvent(
      session,
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello" }],
        },
      } as never,
      "a1",
    );
    await session.moveTo("u1");
    await persistOfficeSessionEvent(
      session,
      {
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello again" }],
        },
      } as never,
      "a2",
    );

    const branch = piBoundFromSessionEntries(await session.getBranch());
    expect(branch.map((row) => row.id)).toEqual(["u1", "a2"]);
    const all = await session.getEntries();
    expect(all.some((entry) => entry.id === "a1")).toBe(true);
    expect(all.filter((entry) => entry.type === "leaf").length).toBeGreaterThan(
      0,
    );
  });

  it("migrates a flat office_chat log into a linear Pi branch", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    await migrateOfficeChatToSession(session, [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
        metadata: { user: { name: "Ada" } },
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-list",
            toolCallId: "c1",
            state: "output-available",
            input: { path: "/" },
            output: { entries: [] },
          },
          { type: "text", text: "empty" },
        ],
      },
    ]);
    const bound = piBoundFromSessionEntries(
      await session.getBranch(),
      await session.getStorage().findEntries("custom"),
    );
    expect(bound[0]).toMatchObject({
      id: "u1",
      metadata: { user: { name: "Ada" } },
    });
    expect(bound.some((row) => row.message.role === "toolResult")).toBe(true);
  });

  it("drops generator tool details so they cannot hit the session tree", async () => {
    const session = new Session(new DurableSessionStorage(memoryStore()));
    const gen = (async function* () {
      yield { stdout: "hi" };
    })();
    await persistOfficeSessionEvent(session, {
      type: "message_end",
      message: {
        role: "toolResult",
        toolCallId: "c1",
        toolName: "exec",
        content: [{ type: "text", text: "{}" }],
        details: gen,
        isError: false,
        timestamp: Date.now(),
      },
    } as never);
    const branch = await session.getBranch();
    expect(() => JSON.stringify(branch)).not.toThrow();
    const tool = branch.find(
      (entry) => entry.type === "message" && entry.message.role === "toolResult",
    );
    expect(tool && tool.type === "message" ? tool.message : null).toMatchObject({
      role: "toolResult",
    });
    expect(
      tool && tool.type === "message" ? tool.message : {},
    ).not.toHaveProperty("details");
  });
});
