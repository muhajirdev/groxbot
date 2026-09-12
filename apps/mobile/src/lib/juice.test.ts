import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const motion = readFileSync(join(root, "../components/Motion.tsx"), "utf8");
const haptics = readFileSync(join(root, "./haptics.ts"), "utf8");
const thread = readFileSync(join(root, "../components/OfficeThread.tsx"), "utf8");
const avatar = readFileSync(join(root, "../components/Avatar.tsx"), "utf8");

describe("mobile juice", () => {
  it("presses squash and overshoot instead of a 3% dip", () => {
    expect(motion).toContain("damping: 11");
    expect(motion).toContain("usePressScale(squash = 0.92)");
    expect(motion).not.toContain("to(0.97)");
  });

  it("pops overshoot with a real scale spring", () => {
    expect(motion).toContain("damping: 9");
    expect(motion).toContain("scale.setValue(0.78)");
    expect(motion).toContain("springTo(scale, 1, POP, delay)");
  });

  it("layers haptic with send, hire, and working squash", () => {
    expect(haptics).toContain("ImpactFeedbackStyle.Soft");
    expect(haptics).toContain("ImpactFeedbackStyle.Medium");
    expect(haptics).toContain("NotificationFeedbackType.Error");
    expect(thread).toContain("usePressScale(0.86)");
    expect(thread).toContain("tapMedium()");
    expect(avatar).toContain("scaleY");
    expect(avatar).toContain("scaleX");
  });
});
