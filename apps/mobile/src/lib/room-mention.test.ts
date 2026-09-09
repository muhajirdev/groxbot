import { describe, expect, it } from "vitest";
import {
  applyRoomMention,
  matchRoomMentions,
  mentionDraftAt,
  seatsFromRoomMembers,
} from "./room-mention";

describe("mentionDraftAt", () => {
  it("reads the token at the caret", () => {
    expect(mentionDraftAt("hey @pi", 7)).toEqual({
      start: 4,
      end: 7,
      needle: "pi",
    });
  });

  it("ignores a mention after a space", () => {
    expect(mentionDraftAt("hey @piper ", 11)).toBeNull();
  });
});

describe("matchRoomMentions", () => {
  const seats = [
    { id: "a", name: "Piper", title: "Talent Scout", archivedAt: null },
    { id: "b", name: "Reja", title: "Chief of Staff", archivedAt: null },
    { id: "c", name: "Old", title: "", archivedAt: "2026-01-01T00:00:00.000Z" },
  ];

  it("skips archived seats and matches name or title", () => {
    expect(matchRoomMentions("", seats).map((row) => row.id)).toEqual([
      "a",
      "b",
    ]);
    expect(matchRoomMentions("scout", seats).map((row) => row.id)).toEqual([
      "a",
    ]);
  });
});

describe("applyRoomMention", () => {
  it("inserts the full name and a trailing space", () => {
    const draft = mentionDraftAt("hey @pi", 7);
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(applyRoomMention("hey @pi", draft, "Piper")).toEqual({
      text: "hey @Piper ",
      caret: 11,
    });
  });
});

describe("seatsFromRoomMembers", () => {
  it("maps room members onto mention seats", () => {
    const seats = seatsFromRoomMembers([
      {
        botId: "bot-1",
        name: "Piper",
        title: "Scout",
        avatarColor: "#111",
        avatarShape: "circle",
        archivedAt: null,
      },
    ]);
    expect(seats[0]?.id).toBe("bot-1");
  });
});
