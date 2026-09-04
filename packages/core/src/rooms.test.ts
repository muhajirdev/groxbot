import { BotSchema } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  assertDeletableGroupRoom,
  isListedGroupRoom,
  mentionFromText,
  parseRoomTurnPayload,
  resolveRoomTarget,
  resolveRoomTargets,
  RoomError,
  roomTurnSystem,
  roomWakeJob,
  assertInvitableToSharedRoom,
} from "./rooms.js";

const steve = { id: "steve", name: "Steve", archivedAt: null };
const hormozi = { id: "hormozi", name: "Hormozi", archivedAt: null };
const archived = {
  id: "old",
  name: "Archie",
  archivedAt: new Date("2020-01-01"),
};

describe("resolveRoomTarget", () => {
  it("wakes the only member without a target", () => {
    expect(resolveRoomTarget([steve]).id).toBe("steve");
  });

  it("goes around the table when nobody is named", () => {
    expect(resolveRoomTargets([steve, hormozi]).map((row) => row.id)).toEqual([
      "steve",
      "hormozi",
    ]);
  });

  it("wakes the named member by id or mention", () => {
    expect(
      resolveRoomTarget([steve, hormozi], { targetBotId: "hormozi" }).name,
    ).toBe("Hormozi");
    expect(resolveRoomTarget([steve, hormozi], { mention: "Steve" }).id).toBe(
      "steve",
    );
  });

  it("lets an @mention beat a focused teammate", () => {
    expect(
      resolveRoomTarget([steve, hormozi], {
        targetBotId: "steve",
        mention: "Hormozi",
      }).id,
    ).toBe("hormozi");
  });

  it("matches a unique first name for a multi-word seat", () => {
    const jobs = { id: "jobs", name: "Steve Jobs", archivedAt: null };
    const alexander = {
      id: "alexander",
      name: "Alexander the Great",
      archivedAt: null,
    };
    expect(
      resolveRoomTarget([jobs, alexander], { mention: "Alexander" }).id,
    ).toBe("alexander");
    expect(
      resolveRoomTarget([jobs, alexander], { mention: "Steve Jobs" }).id,
    ).toBe("jobs");
  });

  it("refuses an empty room and archived seats", () => {
    expect(() => resolveRoomTarget([])).toThrow(/no teammates/);
    expect(() =>
      resolveRoomTarget([steve, archived], { mention: "Archie" }),
    ).toThrow(/archived/);
    expect(() =>
      resolveRoomTarget([steve, hormozi], { mention: "Maya" }),
    ).toThrow(/not in this room/);
  });

  it("refuses a first name that matches two people", () => {
    const jobs = { id: "jobs", name: "Steve Jobs", archivedAt: null };
    const woz = { id: "woz", name: "Steve Wozniak", archivedAt: null };
    expect(() => resolveRoomTarget([jobs, woz], { mention: "Steve" })).toThrow(
      /more than one person/,
    );
  });
});

describe("mentionFromText", () => {
  it("reads the first @name", () => {
    expect(mentionFromText("Hey @Hormozi, jump in")).toBe("Hormozi");
    expect(mentionFromText("@steve go")).toBe("steve");
    expect(mentionFromText("no one")).toBeNull();
  });

  it("reads a seated full name before the first token", () => {
    expect(
      mentionFromText("Hey @Alexander the Great, jump in", [
        "Steve Jobs",
        "Alexander the Great",
      ]),
    ).toBe("Alexander the Great");
  });
});

describe("roomTurnSystem", () => {
  it("keeps the soul and names the table", () => {
    const prompt = roomTurnSystem("You are Steve.", {
      name: "Board",
      selfName: "Steve",
      members: [{ name: "Steve" }, { name: "Hormozi" }],
    });
    expect(prompt.startsWith("You are Steve.")).toBe(true);
    expect(prompt).toMatch(/table "Board"/);
    expect(prompt).toMatch(/not your private office/);
    expect(prompt).toMatch(/Hormozi/);
    expect(prompt).not.toMatch(/going around/);
  });

  it("tells a go-around seat to keep it short", () => {
    const prompt = roomTurnSystem("You are Steve.", {
      name: "Board",
      selfName: "Steve",
      members: [{ name: "Steve" }, { name: "Hormozi" }],
      around: true,
    });
    expect(prompt).toMatch(/going around/);
  });
});

describe("roomWakeJob", () => {
  it("enqueues onto the person, not the place", () => {
    const steveJob = roomWakeJob({
      roomId: "board",
      roomName: "Board",
      members: [
        { id: "steve", name: "Steve", homeRoomId: "home-steve" },
        { id: "hormozi", name: "Hormozi", homeRoomId: "home-hormozi" },
      ],
      messages: [],
      targetBotId: "steve",
      targetHomeRoomId: "home-steve",
    });
    const hormoziJob = roomWakeJob({
      roomId: "board",
      roomName: "Board",
      members: [
        { id: "steve", name: "Steve", homeRoomId: "home-steve" },
        { id: "hormozi", name: "Hormozi", homeRoomId: "home-hormozi" },
      ],
      messages: [],
      targetBotId: "hormozi",
      targetHomeRoomId: "home-hormozi",
    });
    expect(steveJob.name).toBe("room.turn");
    expect(steveJob.botId).toBe("steve");
    expect(hormoziJob.botId).toBe("hormozi");
    expect(steveJob.botId).not.toBe(hormoziJob.botId);
    expect(steveJob.payload.roomId).toBe("board");
    expect(steveJob.payload.homeRoomId).toBe("home-steve");
    expect(hormoziJob.payload.homeRoomId).toBe("home-hormozi");
  });
});

describe("assertInvitableToSharedRoom", () => {
  it("refuses a private teammate at a group table", () => {
    expect(() =>
      assertInvitableToSharedRoom({ name: "Inbox", visibility: "private" }),
    ).toThrow(RoomError);
    expect(() =>
      assertInvitableToSharedRoom({ name: "Inbox", visibility: "private" }),
    ).toThrow(/private and can't join/);
    expect(() =>
      assertInvitableToSharedRoom({ name: "Tutor", visibility: "shared" }),
    ).not.toThrow();
  });
});

describe("isListedGroupRoom", () => {
  it("hides rooms that are someone’s homeRoomId", () => {
    expect(
      isListedGroupRoom("home-steve", ["home-steve", "home-hormozi"]),
    ).toBe(false);
    expect(isListedGroupRoom("standup", ["home-steve", "home-hormozi"])).toBe(
      true,
    );
    expect(isListedGroupRoom("standup", [null, undefined])).toBe(true);
  });
});

describe("assertDeletableGroupRoom", () => {
  it("lets a listed group go and refuses a home office", () => {
    expect(() =>
      assertDeletableGroupRoom("standup", ["home-steve", "home-hormozi"]),
    ).not.toThrow();
    expect(() =>
      assertDeletableGroupRoom("home-steve", ["home-steve", "home-hormozi"]),
    ).toThrow(RoomError);
    expect(() =>
      assertDeletableGroupRoom("home-steve", ["home-steve", "home-hormozi"]),
    ).toThrow(/someone's office/);
  });
});

describe("BotSchema.homeRoomId", () => {
  it("rejects the empty string used when home_room_id is null", () => {
    expect(BotSchema.shape.homeRoomId.safeParse("").success).toBe(false);
    expect(BotSchema.shape.homeRoomId.safeParse("home-1").success).toBe(true);
  });
});

describe("parseRoomTurnPayload", () => {
  it("keeps board log messages and seats", () => {
    const parsed = parseRoomTurnPayload({
      roomId: "board",
      roomName: "Board",
      members: [{ id: "steve", name: "Steve" }],
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      ],
    });
    expect(parsed?.roomId).toBe("board");
    expect(parsed?.members).toEqual([{ id: "steve", name: "Steve" }]);
    expect(parsed?.messages).toEqual([
      {
        id: "u1",
        message: { role: "user", content: "hi", timestamp: 0 },
      },
    ]);
    expect(parseRoomTurnPayload({ roomId: "board" })).toBeNull();
  });
});
