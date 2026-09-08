import { describe, expect, it } from "vitest";
import {
  clipKeepTail,
  formatSize,
  truncateHead,
  truncateLine,
  truncateTail,
  TOOL_TRUNCATE_MAX_BYTES,
} from "./tool-truncate.js";

describe("truncateHead", () => {
  it("keeps a small file whole", () => {
    const truncation = truncateHead("a\nb\nc");
    expect(truncation.truncated).toBe(false);
    expect(truncation.content).toBe("a\nb\nc");
  });

  it("stops at the line cap and reports how far it got", () => {
    const truncation = truncateHead("a\nb\nc\nd", { maxLines: 2, maxBytes: 10_000 });
    expect(truncation.truncated).toBe(true);
    expect(truncation.truncatedBy).toBe("lines");
    expect(truncation.content).toBe("a\nb");
    expect(truncation.outputLines).toBe(2);
  });
});

describe("truncateTail", () => {
  it("keeps the end of a long dump", () => {
    const truncation = truncateTail("a\nb\nc\nd", { maxLines: 2, maxBytes: 10_000 });
    expect(truncation.truncated).toBe(true);
    expect(truncation.content).toBe("c\nd");
  });
});

describe("truncateLine", () => {
  it("marks a long grep line", () => {
    expect(truncateLine("x".repeat(10), 4)).toEqual({
      text: "xxxx... [truncated]",
      wasTruncated: true,
    });
  });
});

describe("clipKeepTail", () => {
  it("keeps a pagination footer when the head is cut", () => {
    const text = `${"h".repeat(80)}Use offset=40 to continue.`;
    const clipped = clipKeepTail(text, 160);
    expect(clipped.length).toBeLessThanOrEqual(160);
    expect(clipped).toMatch(/offset=40/);
  });
});

describe("formatSize", () => {
  it("formats the Pi byte cap", () => {
    expect(formatSize(TOOL_TRUNCATE_MAX_BYTES)).toBe("50.0KB");
  });
});
