import { describe, expect, it } from "vitest";
import { orpc } from "./orpc";
import {
  isComputerListQueryKey,
  isComputerReadQueryKey,
  isKnowledgeReadQueryKey,
  shouldDehydrateOfficeQuery,
  officeCacheEnabled,
} from "./office-persist";

describe("query persist", () => {
  it("does not open IndexedDB in node tests", () => {
    expect(officeCacheEnabled()).toBe(false);
  });

  it("dehydrates successful office-messages and catalog queries", () => {
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: ["office-messages", "bot-1"],
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: ["room-messages", "room-1"],
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.rooms.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.bots.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.apps.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.plugins.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.mcp.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.knowledge.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.workspaces.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: ["plugin-catalog"],
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: ["office-messages", "bot-1"],
        state: { status: "pending" },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: ["auth", "session"],
        state: { status: "success" },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: orpc.me.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(false);
  });

  it("dehydrates each bot’s computer file list, not downloads", () => {
    const listed = orpc.computer.list.queryOptions({
      input: { botId: "bot-1" },
    }).queryKey;
    const other = orpc.computer.list.queryOptions({
      input: { botId: "bot-2" },
    }).queryKey;
    expect(isComputerListQueryKey(listed)).toBe(true);
    expect(isComputerListQueryKey(other)).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: listed,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: listed,
        state: { status: "pending" },
      }),
    ).toBe(false);
    expect(
      isComputerListQueryKey(
        orpc.computer.download.queryOptions({
          input: { botId: "bot-1", path: "inbox/notes.md" },
        }).queryKey,
      ),
    ).toBe(false);
    expect(
      isComputerListQueryKey(orpc.bots.list.queryOptions().queryKey),
    ).toBe(false);
  });

  it("dehydrates small text file reads, not downloads or binaries", () => {
    const knowledgeRead = orpc.knowledge.read.queryOptions({
      input: { path: "people/contact.md" },
    }).queryKey;
    const otherRead = orpc.knowledge.read.queryOptions({
      input: { path: "how-we-work/voice.md" },
    }).queryKey;
    const knowledgeDownload = orpc.knowledge.download.queryOptions({
      input: { path: "people/contact.md" },
    }).queryKey;
    const computerRead = orpc.computer.read.queryOptions({
      input: { botId: "bot-1", path: "notes.md" },
    }).queryKey;
    const computerDownload = orpc.computer.download.queryOptions({
      input: { botId: "bot-1", path: "notes.md" },
    }).queryKey;
    const body = {
      path: "people/contact.md",
      content: "# Contact",
      encoding: "text" as const,
    };
    expect(isKnowledgeReadQueryKey(knowledgeRead)).toBe(true);
    expect(isKnowledgeReadQueryKey(otherRead)).toBe(true);
    expect(isKnowledgeReadQueryKey(knowledgeDownload)).toBe(false);
    expect(isComputerReadQueryKey(computerRead)).toBe(true);
    expect(isComputerListQueryKey(computerRead)).toBe(false);
    expect(isComputerReadQueryKey(computerDownload)).toBe(false);
    expect(isComputerReadQueryKey(knowledgeRead)).toBe(false);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: knowledgeRead,
        state: { status: "success", data: body },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: computerRead,
        state: { status: "success", data: body },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: knowledgeRead,
        state: { status: "success", data: { ...body, encoding: "binary" } },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: knowledgeDownload,
        state: { status: "success", data: body },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateOfficeQuery({
        queryKey: computerDownload,
        state: { status: "success" },
      }),
    ).toBe(false);
  });
});
