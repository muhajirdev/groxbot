import { describe, expect, it } from "vitest";
import {
  draftCreatedBot,
  NEW_BOT_NAME,
  nextAvatarColor,
  nextHireName,
} from "./hire";
import { AVATAR_COLORS } from "./jobs";

describe("nextHireName", () => {
  it("starts at New Bot", () => {
    expect(nextHireName([])).toBe(NEW_BOT_NAME);
    expect(nextHireName([{ name: "Piper" }])).toBe(NEW_BOT_NAME);
  });

  it("increments when New Bot is taken", () => {
    expect(nextHireName([{ name: NEW_BOT_NAME }])).toBe("New Bot 2");
    expect(nextHireName([{ name: NEW_BOT_NAME }, { name: "New Bot 2" }])).toBe(
      "New Bot 3",
    );
  });
});

describe("nextAvatarColor", () => {
  it("picks the first unused swatch", () => {
    expect(nextAvatarColor([])).toBe(AVATAR_COLORS[0]);
    expect(nextAvatarColor([{ avatarColor: AVATAR_COLORS[0] }])).toBe(
      AVATAR_COLORS[1],
    );
  });
});

describe("draftCreatedBot", () => {
  it("fills a roster row the office can render immediately", () => {
    const bot = draftCreatedBot({
      id: "bot-1",
      workspaceId: "ws-1",
      name: "New Bot",
      avatarColor: "#e45c9a",
    });
    expect(bot.id).toBe("bot-1");
    expect(bot.threadId).toBe("bot-1");
    expect(bot.homeRoomId).toBe("bot-1");
    expect(bot.guestKind).toBe("off");
    expect(bot.archivedAt).toBeNull();
    expect(bot.pinnedAt).toBeNull();
    expect(bot.sectionId).toBeNull();
  });
});
