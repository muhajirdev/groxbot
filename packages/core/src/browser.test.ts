import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));

function collect(entry: string): Map<string, string> {
  const out = new Map<string, string>();
  const queue = [entry];
  while (queue.length) {
    const name = queue.pop()!;
    if (out.has(name)) continue;
    const src = readFileSync(join(root, name), "utf8");
    out.set(name, src);
    for (const match of src.matchAll(/from "(\.\/[^"]+)\.js"/g)) {
      queue.push(`${match[1].slice(2)}.ts`);
    }
  }
  return out;
}

describe("browser entry", () => {
  it("does not pull node:crypto, drizzle, or db into the SPA", () => {
    const files = collect("browser.ts");
    expect([...files.keys()].sort()).toEqual([
      "browser.ts",
      "ids.ts",
      "office-chat.ts",
      "pi-projection.ts",
      "pi-transcript.ts",
      "room-speaker.ts",
      "room-target.ts",
      "routine-clock.ts",
      "sidebar-roster.ts",
    ]);
    for (const [name, src] of files) {
      expect(src, name).not.toMatch(/from "node:/);
      expect(src, name).not.toMatch(/@groxbot\/db/);
      expect(src, name).not.toMatch(/drizzle-orm/);
    }
  });
});
