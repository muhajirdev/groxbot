import { describe, expect, it } from "vitest";
import {
  CLAY_AVATAR_COUNT,
  clayAvatarIndex,
  clayAvatarSrc,
} from "./clay-avatar";

describe("clayAvatarSrc", () => {
  it("maps a seed to a planga file in the pack", () => {
    expect(clayAvatarSrc("bot_1")).toMatch(
      /^\/clay\/pixel-planga-seated-\d{2}\.jpg$/,
    );
    expect(clayAvatarIndex("bot_1")).toBeGreaterThanOrEqual(0);
    expect(clayAvatarIndex("bot_1")).toBeLessThan(CLAY_AVATAR_COUNT);
  });

  it("is stable for the same seed", () => {
    expect(clayAvatarSrc("Chief of Staff")).toBe(
      clayAvatarSrc("Chief of Staff"),
    );
  });

  it("spreads different seeds across the pack", () => {
    const indexes = new Set(
      Array.from({ length: 40 }, (_, i) => clayAvatarIndex(`bot-${i}`)),
    );
    expect(indexes.size).toBeGreaterThan(8);
  });
});
