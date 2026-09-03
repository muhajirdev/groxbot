import { describe, expect, it } from "vitest";
import {
  computerDownloadFilename,
  decodeDownloadBytes,
} from "./computer-download";

describe("computerDownloadFilename", () => {
  it("takes the last path segment", () => {
    expect(computerDownloadFilename("inbox/notes.md")).toBe("notes.md");
    expect(computerDownloadFilename("")).toBe("file");
  });
});

describe("decodeDownloadBytes", () => {
  it("decodes base64", () => {
    expect(decodeDownloadBytes(btoa("office"))).toEqual(
      new TextEncoder().encode("office"),
    );
  });
});
