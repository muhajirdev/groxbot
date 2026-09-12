import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const thread = readFileSync(join(root, "../screens/Thread.tsx"), "utf8");
const office = readFileSync(join(root, "../components/OfficeThread.tsx"), "utf8");
const title = readFileSync(join(root, "../components/ThreadTitle.tsx"), "utf8");

describe("thread chrome", () => {
  it("uses a name pill, gray bubbles, and a single composer capsule", () => {
    expect(thread).toContain("ThreadTitle");
    expect(thread).toContain("desktopcomputer");
    expect(thread).toContain('headerBackButtonDisplayMode: "minimal"');
    expect(title).toContain("styles.pill");
    expect(office).toContain("assistantBubble");
    expect(office).toContain("borderRadius: 26");
    expect(office).toContain("`Ask ${props.botName}`");
  });
});
