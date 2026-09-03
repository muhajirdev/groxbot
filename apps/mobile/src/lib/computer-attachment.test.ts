import { describe, expect, it } from "vitest";
import {
  assertAttachable,
  base64ToBytes,
  bytesToBase64,
  computerFileNote,
  OfficeBlobFile,
  workspaceAttachmentText,
} from "./computer-attachment";

describe("computerFileNote", () => {
  it("names the inbox path as a chat note", () => {
    expect(computerFileNote("inbox/brief.md")).toBe(
      "On this computer: inbox/brief.md",
    );
    expect(workspaceAttachmentText("inbox/brief.md")).toContain(
      "inbox/brief.md",
    );
  });
});

describe("assertAttachable", () => {
  it("caps at six files", () => {
    expect(() =>
      assertAttachable({ name: "a.md", size: 10, pending: 6 }),
    ).toThrow(/up to 6/);
  });
});

describe("OfficeBlobFile", () => {
  it("round-trips bytes for the attachment adapter", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const file = new OfficeBlobFile({
      name: "note.md",
      type: "text/markdown",
      bytes,
    });
    expect(file.size).toBe(4);
    expect(bytesToBase64(new Uint8Array(await file.arrayBuffer()))).toBe(
      bytesToBase64(bytes),
    );
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual([
      1, 2, 3, 4,
    ]);
  });
});
