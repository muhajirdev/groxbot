import { describe, expect, it } from "vitest";
import { orpc } from "./orpc";
import {
  isComputerListQueryKey,
  shouldDehydrateThinkQuery,
  thinkCacheEnabled,
} from "./think-persist";

describe("query persist", () => {
  it("does not open IndexedDB in node tests", () => {
    expect(thinkCacheEnabled()).toBe(false);
  });

  it("dehydrates successful think-messages and catalog queries", () => {
    expect(
      shouldDehydrateThinkQuery({
        queryKey: ["think-messages", "bot-1"],
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: orpc.bots.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: orpc.apps.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: orpc.plugins.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: orpc.mcp.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: orpc.knowledge.list.queryOptions().queryKey,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: ["think-messages", "bot-1"],
        state: { status: "pending" },
      }),
    ).toBe(false);
    expect(
      shouldDehydrateThinkQuery({
        queryKey: ["auth", "session"],
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
      shouldDehydrateThinkQuery({
        queryKey: listed,
        state: { status: "success" },
      }),
    ).toBe(true);
    expect(
      shouldDehydrateThinkQuery({
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
});
