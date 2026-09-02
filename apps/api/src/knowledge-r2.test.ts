import { describe, expect, it } from "vitest";
import { r2KnowledgeDisk, type KnowledgeBucket } from "./knowledge-r2.js";

class MemoryBucket implements KnowledgeBucket {
  readonly files = new Map<string, Uint8Array>();

  async list(options: { prefix: string }) {
    const objects = [...this.files.entries()]
      .filter(([key]) => key.startsWith(options.prefix))
      .map(([key, bytes]) => ({
        key,
        size: bytes.byteLength,
        uploaded: new Date(0),
      }));
    return { objects, truncated: false };
  }

  async get(key: string) {
    const bytes = this.files.get(key);
    if (!bytes) return null;
    return {
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  }

  async put(key: string, value: string | ArrayBuffer | Uint8Array | ArrayBufferView) {
    const bytes =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
          ? value
          : new Uint8Array(value as ArrayBuffer);
    this.files.set(key, bytes);
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}

describe("r2KnowledgeDisk", () => {
  it("round-trips a text object", async () => {
    const disk = r2KnowledgeDisk(new MemoryBucket());
    await disk.put("ws_1/notes/voice.md", "Be brief.", "text/markdown");
    await expect(disk.getText("ws_1/notes/voice.md")).resolves.toBe("Be brief.");
    const listed = await disk.list("ws_1/");
    expect(listed.map((row) => row.key)).toEqual(["ws_1/notes/voice.md"]);
  });
});
