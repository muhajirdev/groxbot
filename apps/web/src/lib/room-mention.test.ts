import { describe, expect, it } from "vitest";
import {
  applyRoomMention,
  matchRoomMentions,
  mentionDraftAt,
} from "./room-mention";

const steve = {
  id: "steve",
  name: "Steve Jobs",
  title: "Product",
  archivedAt: null,
};
const hormozi = {
  id: "hormozi",
  name: "Hormozi",
  title: "Offers",
  archivedAt: null,
};
const archived = {
  id: "old",
  name: "Archie",
  archivedAt: "2020-01-01",
};
const alexander = {
  id: "alexander",
  name: "Alexander the Great",
  archivedAt: null,
};

describe("mentionDraftAt", () => {
  it("is idle until an @ token is at the caret", () => {
    expect(mentionDraftAt("hello", 5)).toBeNull();
    expect(mentionDraftAt("email foo@bar.com", 17)).toBeNull();
  });

  it("opens on a bare @", () => {
    expect(mentionDraftAt("@", 1)).toEqual({ start: 0, end: 1, needle: "" });
    expect(mentionDraftAt("hey @", 5)).toEqual({
      start: 4,
      end: 5,
      needle: "",
    });
  });

  it("reads the token around the caret", () => {
    expect(mentionDraftAt("hey @Ste", 8)).toEqual({
      start: 4,
      end: 8,
      needle: "Ste",
    });
    expect(mentionDraftAt("hey @Steve go", 8)).toEqual({
      start: 4,
      end: 10,
      needle: "Steve",
    });
  });

  it("closes once a space ends the token", () => {
    expect(mentionDraftAt("hey @Ste rest", 13)).toBeNull();
  });
});

describe("matchRoomMentions", () => {
  const seats = [steve, hormozi, archived, alexander];

  it("lists live seats for a bare @", () => {
    expect(matchRoomMentions("", seats).map((row) => row.id)).toEqual([
      "steve",
      "hormozi",
      "alexander",
    ]);
  });

  it("filters by name, first word, or title", () => {
    expect(matchRoomMentions("hor", seats).map((row) => row.id)).toEqual([
      "hormozi",
    ]);
    expect(matchRoomMentions("steve", seats).map((row) => row.id)).toEqual([
      "steve",
    ]);
    expect(matchRoomMentions("alex", seats).map((row) => row.id)).toEqual([
      "alexander",
    ]);
    expect(matchRoomMentions("offer", seats).map((row) => row.id)).toEqual([
      "hormozi",
    ]);
  });
});

describe("applyRoomMention", () => {
  it("replaces the draft with the seated full name", () => {
    const draft = mentionDraftAt("hey @Ste", 8);
    expect(draft).not.toBeNull();
    expect(applyRoomMention("hey @Ste", draft!, "Hormozi")).toEqual({
      text: "hey @Hormozi ",
      caret: 13,
    });
  });

  it("keeps text after the token", () => {
    const text = "ask @Ste please";
    const draft = mentionDraftAt(text, 8);
    expect(draft).not.toBeNull();
    expect(applyRoomMention(text, draft!, "Steve Jobs")).toEqual({
      text: "ask @Steve Jobs please",
      caret: 16,
    });
  });
});
