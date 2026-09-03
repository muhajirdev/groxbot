import { describe, expect, it } from "vitest";
import {
  avatarObjectKey,
  avatarPublicPath,
  decodeAvatarPayload,
  publishedProfileImage,
  readAvatar,
  sniffAvatarMediaType,
  writeAvatar,
} from "./avatar.js";
import type { KnowledgeDisk, KnowledgeObject } from "./knowledge.js";

/** 1×1 PNG. */
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (ch) => ch.charCodeAt(0),
);

describe("avatar bytes", () => {
  it("sniffs png", () => {
    expect(sniffAvatarMediaType(PNG)).toBe("image/png");
  });

  it("rejects a random payload", () => {
    expect(sniffAvatarMediaType(new TextEncoder().encode("hello"))).toBeNull();
  });

  it("decodes a data URL", () => {
    const content = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`;
    expect(decodeAvatarPayload(content)).toEqual(PNG);
  });
});

describe("avatar paths", () => {
  it("keeps the object off the office knowledge prefix", () => {
    expect(avatarObjectKey("usr_1")).toBe("_avatars/usr_1");
    expect(avatarPublicPath("usr_1")).toBe("/avatars/usr_1");
  });

  it("rejects a pathing user id", () => {
    expect(() => avatarObjectKey("../x")).toThrow(/unknown person/i);
  });
});

describe("publishedProfileImage", () => {
  it("passes through a hosted photo", () => {
    expect(
      publishedProfileImage(
        "https://lh3.googleusercontent.com/a/photo",
        "usr_1",
        1,
        "https://api.groxbot.com",
      ),
    ).toBe("https://lh3.googleusercontent.com/a/photo");
  });

  it("rewrites a stored avatar onto the API origin", () => {
    expect(
      publishedProfileImage(
        "/avatars/usr_1",
        "usr_1",
        42,
        "https://api.groxbot.com/",
      ),
    ).toBe("https://api.groxbot.com/avatars/usr_1?v=42");
  });
});

describe("avatar disk", () => {
  it("writes and reads a png off the office tree", async () => {
    const files = new Map<string, Uint8Array>();
    const disk: KnowledgeDisk = {
      async list(prefix) {
        return [...files.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, bytes]): KnowledgeObject => ({
            key,
            size: bytes.byteLength,
          }));
      },
      async getText() {
        return null;
      },
      async getBytes(key) {
        return files.get(key) ?? null;
      },
      async put(key, content) {
        files.set(
          key,
          typeof content === "string"
            ? new TextEncoder().encode(content)
            : content,
        );
      },
      async delete(key) {
        files.delete(key);
      },
    };
    await expect(writeAvatar(disk, "usr_1", PNG)).resolves.toBe(
      "/avatars/usr_1",
    );
    expect([...files.keys()]).toEqual(["_avatars/usr_1"]);
    const stored = await readAvatar(disk, "usr_1");
    expect(stored?.mediaType).toBe("image/png");
    expect(stored?.bytes).toEqual(PNG);
  });
});
