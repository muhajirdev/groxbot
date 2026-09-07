import { describe, expect, it } from "vitest";
import { GROXBOT_DISCORD_URL } from "./support-chat";

describe("support chat", () => {
  it("points at the Groxbot Discord invite", () => {
    expect(GROXBOT_DISCORD_URL).toBe("https://discord.gg/fkHVwxJbx");
  });
});
