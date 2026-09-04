import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");
const apiRequire = createRequire(join(import.meta.dirname, "../package.json"));
const rootPackage = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as { pnpm: { overrides: { chat?: string } } };

function packageRoot(fromFile: string): string {
  let dir = dirname(fromFile);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error(`No package.json above ${fromFile}`);
}

function listJs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listJs(path);
    }
    return entry.name.endsWith(".js") ? [path] : [];
  });
}

describe("workerd-safe agent deps", () => {
  it("pins chat below the 4.39.0 module-scope AbortController", () => {
    expect(rootPackage.pnpm.overrides.chat).toBe("4.38.1");
  });

  it("does not construct AbortController while evaluating chat", () => {
    const agentsRoot = packageRoot(apiRequire.resolve("agents"));
    const chatRoot = join(dirname(agentsRoot), "chat");
    expect(existsSync(join(chatRoot, "package.json"))).toBe(true);
    const chatPackage = JSON.parse(
      readFileSync(join(chatRoot, "package.json"), "utf8"),
    ) as { version: string };
    expect(chatPackage.version).toBe("4.38.1");
    const files = listJs(join(chatRoot, "dist"));
    const hits = files.filter((file) =>
      /^\s*(?:var|const|let)\s+\w+\s*=\s*new AbortController\s*\(/m.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(hits).toEqual([]);
  });
});
