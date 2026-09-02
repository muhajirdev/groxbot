import { describe, expect, it } from "vitest";
import {
  computerDownloadBlob,
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

describe("computerDownloadBlob", () => {
  it("builds a blob with the file type", async () => {
    const blob = computerDownloadBlob({
      path: "inbox/notes.md",
      filename: "notes.md",
      content: btoa("office notes"),
      mediaType: "text/markdown",
    });
    expect(blob.type).toBe("text/markdown");
    expect(await blob.text()).toBe("office notes");
  });
});
