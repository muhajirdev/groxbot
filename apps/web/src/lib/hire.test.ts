import { afterEach, describe, expect, it } from "vitest";
import {
  beginHire,
  draftCreatedBot,
  endHire,
  isHireInFlight,
  NEW_BOT_NAME,
  nextAvatarColor,
  nextHireName,
  settleCreatedHire,
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
    expect(bot.visibility).toBe("shared");
    expect(bot.userId).toBe("user");
    expect(bot.archivedAt).toBeNull();
    expect(bot.pinnedAt).toBeNull();
    expect(bot.sectionId).toBeNull();
  });

  it("can draft a private teammate", () => {
    const bot = draftCreatedBot({
      id: "bot-1",
      workspaceId: "ws-1",
      name: "Inbox",
      avatarColor: "#e45c9a",
      visibility: "private",
    });
    expect(bot.visibility).toBe("private");
  });

  it("preserves optional title when provided", () => {
    const bot = draftCreatedBot({
      id: "bot-1",
      workspaceId: "ws-1",
      name: "Hormozi",
      avatarColor: "#e45c9a",
      title: "Offer & content coach",
    });
    expect(bot.title).toBe("Offer & content coach");
  });
});

describe("hire lock", () => {
  afterEach(() => {
    endHire();
  });

  it("rejects a second hire until the first settles", () => {
    expect(beginHire()).toBe(true);
    expect(isHireInFlight()).toBe(true);
    expect(beginHire()).toBe(false);
    endHire();
    expect(beginHire()).toBe(true);
  });
});

describe("settleCreatedHire", () => {
  it("returns create when it succeeds", async () => {
    const bot = draftCreatedBot({
      id: "bot-1",
      workspaceId: "ws-1",
      name: "Invoice Maker",
      avatarColor: "#e45c9a",
    });
    await expect(
      settleCreatedHire({
        botId: bot.id,
        create: async () => bot,
        get: async () => {
          throw new Error("unused");
        },
      }),
    ).resolves.toBe(bot);
  });

  it("keeps the committed row when create times out", async () => {
    const bot = draftCreatedBot({
      id: "bot-1",
      workspaceId: "ws-1",
      name: "Invoice Maker",
      avatarColor: "#e45c9a",
    });
    await expect(
      settleCreatedHire({
        botId: bot.id,
        create: async () => {
          throw new Error("timeout");
        },
        get: async () => bot,
      }),
    ).resolves.toBe(bot);
  });

  it("rethrows when the server never got the insert", async () => {
    await expect(
      settleCreatedHire({
        botId: "bot-1",
        create: async () => {
          throw new Error("offline");
        },
        get: async () => {
          throw new Error("not found");
        },
      }),
    ).rejects.toThrow("offline");
  });
});
