import type { Bot } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  buildHarnessExport,
  HARNESS_EXPORT_KIND,
  harnessExportFilename,
  MAX_HARNESS_FILE_READS,
} from "./office-harness-export";

const bot = {
  id: "bot-1",
  workspaceId: "ws-1",
  userId: "user-1",
  visibility: "shared",
  name: "Mike",
  title: "",
  description: "",
  instructions: "Be Mike.",
  avatarColor: "#e45c9a",
  avatarShape: "circle",
  parentBotId: null,
  threadId: "bot-1",
  homeRoomId: "room-1",
  guestKind: "off",
  guestOnline: false,
  model: "groxbot/openai/gpt-5.6-luna",
  lastPreview: "",
  lastAt: "",
  archivedAt: null,
  pinnedAt: null,
  sectionId: null,
  createdAt: "",
  updatedAt: "",
} as Bot;

describe("harnessExportFilename", () => {
  it("slugifies the teammate name", () => {
    expect(harnessExportFilename({ name: "Mike / CoS", id: "bot-1" })).toMatch(
      /^groxbot-mike-cos-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });
});

describe("buildHarnessExport", () => {
  it("packs transcript, tool calls, and computer text files", async () => {
    const bundle = await buildHarnessExport(bot, {
      list: async () => ({
        entries: [
          { path: "inbox", kind: "dir" },
          { path: "inbox/brief.md", kind: "file", size: 12 },
          { path: "inbox/photo.png", kind: "file", size: 80 },
        ],
        truncated: false,
      }),
      read: async (_botId, path) =>
        path.endsWith(".png")
          ? {
              path,
              content: "",
              truncated: false,
              encoding: "binary",
            }
          : {
              path,
              content: "hello desk",
              truncated: false,
              encoding: "text",
            },
      routines: () => [],
      messages: () => [],
      officeView: () => ({
        connected: true,
        view: {
          threadId: "room-1",
          messages: [
            {
              id: "u1",
              message: { role: "user", content: "hey", timestamp: 1 },
            },
            {
              id: "a1",
              message: {
                role: "assistant",
                content: [
                  {
                    type: "toolCall",
                    id: "c1",
                    name: "shell",
                    arguments: { command: "ls" },
                  },
                ],
                timestamp: 2,
                stopReason: "toolUse",
              },
            },
            {
              id: "t1",
              message: {
                role: "toolResult",
                toolCallId: "c1",
                toolName: "shell",
                content: [{ type: "text", text: "inbox" }],
                isError: false,
                timestamp: 3,
              },
            },
          ],
          streaming: null,
          toolExecutions: {},
          status: "ready",
          error: "",
          generation: 0,
          seq: 4,
          floorBotId: "",
          focusedAppId: "",
        },
      }),
      debugLog: () => ["turn_start +0ms"],
    });
    expect(bundle.kind).toBe(HARNESS_EXPORT_KIND);
    expect(bundle.bot.model).toBe("groxbot/openai/gpt-5.6-luna");
    expect(bundle.office.messages).toHaveLength(3);
    expect(bundle.office.messages[1]?.message).toMatchObject({
      role: "assistant",
    });
    expect(bundle.computer.files.map((row) => row.path)).toEqual([
      "inbox",
      "inbox/brief.md",
      "inbox/photo.png",
    ]);
    expect(bundle.computer.files[1]).toMatchObject({
      content: "hello desk",
      encoding: "text",
    });
    expect(bundle.computer.files[2]).toMatchObject({ skipped: "binary" });
    expect(bundle.debugLog).toEqual(["turn_start +0ms"]);
  });

  it("prefers a Durable Object snapshot over the live view", async () => {
    const bundle = await buildHarnessExport(bot, {
      list: async () => ({ entries: [], truncated: false }),
      read: async () => {
        throw new Error("unused");
      },
      routines: () => [],
      messages: () => [
        {
          id: "cached",
          message: { role: "user", content: "cached", timestamp: 1 },
        },
      ],
      snapshotMessages: async () => [
        {
          id: "snap",
          message: { role: "user", content: "from DO", timestamp: 2 },
        },
        {
          id: "tool",
          message: {
            role: "toolResult",
            toolCallId: "c1",
            toolName: "code",
            content: [{ type: "text", text: "ok" }],
            isError: false,
            timestamp: 3,
          },
        },
      ],
      officeView: () => ({
        connected: true,
        view: {
          threadId: "room-1",
          messages: [
            {
              id: "live",
              message: { role: "user", content: "live", timestamp: 1 },
            },
          ],
          streaming: null,
          toolExecutions: {},
          status: "ready",
          error: "",
          generation: 0,
          seq: 1,
          floorBotId: "",
          focusedAppId: "",
        },
      }),
    });
    expect(bundle.office.messages.map((row) => row.id)).toEqual(["snap", "tool"]);
  });

  it("caps file reads", async () => {
    const entries = Array.from({ length: MAX_HARNESS_FILE_READS + 2 }, (_, i) => ({
      path: `f${i}.txt`,
      kind: "file" as const,
    }));
    const bundle = await buildHarnessExport(bot, {
      list: async () => ({ entries, truncated: false }),
      read: async (_botId, path) => ({
        path,
        content: "x",
        truncated: false,
        encoding: "text",
      }),
      routines: () => [],
      messages: () => [],
    });
    expect(
      bundle.computer.files.filter((row) => row.skipped === "file-read-cap"),
    ).toHaveLength(2);
    expect(bundle.computer.truncated).toBe(true);
  });

  it("still dumps the log when the computer list fails", async () => {
    const bundle = await buildHarnessExport(bot, {
      list: async () => {
        throw new Error("computer offline");
      },
      read: async () => {
        throw new Error("unused");
      },
      routines: () => [],
      messages: () => [
        {
          id: "u1",
          message: { role: "user", content: "hey", timestamp: 1 },
        },
      ],
    });
    expect(bundle.office.messages).toHaveLength(1);
    expect(bundle.computer).toMatchObject({
      error: "computer offline",
      files: [],
    });
  });
});
