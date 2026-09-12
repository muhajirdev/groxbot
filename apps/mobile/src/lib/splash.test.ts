import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const splash = readFileSync(join(root, "../components/Splash.tsx"), "utf8");
const app = readFileSync(join(root, "../../App.tsx"), "utf8");

describe("mobile splash", () => {
  it("opens on a teammate cluster instead of a spinner", () => {
    expect(app).toContain('from "./src/components/Splash"');
    expect(app).toContain("fallback={<Splash />}");
    expect(app).not.toContain("ActivityIndicator");
    expect(splash).toContain("Opening Groxbot");
    expect(splash).toContain("Ada");
    expect(splash).toContain("Sam");
    expect(splash).toContain("Kai");
    expect(splash).toContain("reduceMotion");
    expect(splash).toContain("Groxbot");
  });
});
