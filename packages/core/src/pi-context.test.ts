import { describe, expect, it } from "vitest";
import {
  liveToolResultText,
  pruneLiveToolResults,
} from "./pi-context.js";

function toolResult(
  id: string,
  text: string,
  extra?: {
    details?: unknown;
    toolName?: string;
    content?: Array<
      | { type: "text"; text: string }
      | { type: "image"; data: string; mimeType: string }
    >;
  },
) {
  return {
    role: "toolResult" as const,
    toolCallId: id,
    toolName: extra?.toolName ?? "code",
    content: extra?.content ?? [{ type: "text" as const, text }],
    details: extra?.details,
    isError: false,
    timestamp: 1,
  };
}

function imageResult(id: string, data = "abc") {
  return toolResult(id, `Read image file [image/png] shot.png`, {
    toolName: "read",
    content: [
      { type: "text", text: `Read image file [image/png] shot.png` },
      { type: "image", data, mimeType: "image/png" },
    ],
  });
}

describe("pruneLiveToolResults", () => {
  it("stubs old tool dumps and keeps the latest round", () => {
    const fat = "g".repeat(4_000);
    const live = "ok-now";
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "check gmail", timestamp: 1 },
        toolResult("old", fat),
        { role: "assistant", content: [{ type: "text", text: "done" }], timestamp: 2 },
        { role: "user", content: "check again", timestamp: 3 },
        toolResult("new", live),
      ],
      { maxChars: 100, staleChars: 80 },
    );
    expect(liveToolResultText(pruned[1]!)).toMatch(/^Omitted from the live window/);
    expect(liveToolResultText(pruned[1]!)).toMatch(/4000 chars/);
    expect(pruned[1]).toMatchObject({
      role: "toolResult",
      details: { omitted: true, bytes: fat.length },
    });
    expect(liveToolResultText(pruned[4]!)).toBe(live);
  });

  it("stubs earlier dumps on the same turn and keeps the latest", () => {
    const search = "s".repeat(4_000);
    const list = "ok-now";
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "list tracks", timestamp: 1 },
        toolResult("search", search),
        toolResult("list", list),
      ],
      { maxChars: 100, staleChars: 80 },
    );
    expect(liveToolResultText(pruned[1]!)).toMatch(/^Omitted from the live window/);
    expect(liveToolResultText(pruned[2]!)).toBe(list);
  });

  it("caps a huge result on the current turn", () => {
    const fat = "h".repeat(200);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "fetch", timestamp: 1 },
        toolResult("live", fat),
      ],
      { maxChars: 40, staleChars: 10 },
    );
    const text = liveToolResultText(pruned[1]!);
    expect(text).toMatch(/truncated/);
    expect(text).toMatch(/200 chars/);
    expect(text.length).toBeLessThan(fat.length);
    expect(pruned[0]).toMatchObject({ role: "user", content: "fetch" });
  });

  it("does not mutate the original messages", () => {
    const original = toolResult("keep", "x".repeat(50), { details: { raw: true } });
    const messages = [{ role: "user" as const, content: "hi" }, original];
    pruneLiveToolResults(messages, { staleChars: 8 });
    expect(liveToolResultText(original)).toBe("x".repeat(50));
    expect(original.details).toEqual({ raw: true });
  });

  it("keeps a latest computer read under the 50KB file cap", () => {
    const body = "line\n".repeat(4_000);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "read", timestamp: 1 },
        toolResult("read-1", body, { toolName: "read" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toBe(body);
  });

  it("keeps a latest to_markdown page under the 50KB file cap", () => {
    const body = "n".repeat(19_662);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "convert", timestamp: 1 },
        toolResult("md-1", body, { toolName: "to_markdown" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toBe(body);
  });

  it("keeps this turn's to_markdown after a later grep", () => {
    const body = "n".repeat(19_662);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "invoice", timestamp: 1 },
        toolResult("md-1", body, { toolName: "to_markdown" }),
        toolResult("md-2", "agreement body", { toolName: "to_markdown" }),
        toolResult("g-1", "Rp 35,000,000", { toolName: "grep" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toBe(body);
    expect(liveToolResultText(pruned[2]!)).toBe("agreement body");
    expect(liveToolResultText(pruned[3]!)).toBe("Rp 35,000,000");
  });

  it("keeps this turn's read after a later grep", () => {
    const body = "line\n".repeat(4_000);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "read it", timestamp: 1 },
        toolResult("read-1", body, { toolName: "read" }),
        toolResult("g-1", "hit", { toolName: "grep" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toBe(body);
    expect(liveToolResultText(pruned[2]!)).toBe("hit");
  });

  it("stubs a prior-turn to_markdown after the next user message", () => {
    const body = "n".repeat(19_662);
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "convert", timestamp: 1 },
        toolResult("md-1", body, { toolName: "to_markdown" }),
        { role: "user", content: "now invoice", timestamp: 2 },
        toolResult("g-1", "ok", { toolName: "grep" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toMatch(/^Omitted from the live window/);
    expect(liveToolResultText(pruned[1]!)).not.toMatch(/in code/);
    expect(liveToolResultText(pruned[3]!)).toBe("ok");
  });

  it("stubs a prior-turn image after the next user message", () => {
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "check layout", timestamp: 1 },
        imageResult("shot-1"),
        { role: "user", content: "now invoice", timestamp: 2 },
        toolResult("g-1", "ok", { toolName: "grep" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toMatch(
      /^Omitted from the live window \(image/,
    );
    expect(pruned[1]).toMatchObject({
      details: { omitted: true, image: true },
    });
    expect(pruned[1]?.content).toEqual([
      { type: "text", text: expect.stringMatching(/image/) },
    ]);
    expect(liveToolResultText(pruned[3]!)).toBe("ok");
  });

  it("keeps this turn's latest image after a later grep", () => {
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "invoice", timestamp: 1 },
        imageResult("shot-1"),
        toolResult("g-1", "hit", { toolName: "grep" }),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(pruned[1]?.content).toEqual(
      imageResult("shot-1").content,
    );
    expect(liveToolResultText(pruned[2]!)).toBe("hit");
  });

  it("stubs an older image when a newer image lands on the same turn", () => {
    const pruned = pruneLiveToolResults(
      [
        { role: "user", content: "invoice", timestamp: 1 },
        imageResult("shot-1", "old"),
        imageResult("shot-2", "new"),
      ],
      { maxChars: 100, staleChars: 10 },
    );
    expect(liveToolResultText(pruned[1]!)).toMatch(
      /^Omitted from the live window \(image/,
    );
    expect(pruned[2]?.content).toEqual(imageResult("shot-2", "new").content);
  });
});
