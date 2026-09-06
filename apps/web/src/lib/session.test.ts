import { describe, expect, it } from "vitest";
import { catalogHasRoom, officeProfileLabel, unknownRoomRedirect } from "./session";

describe("officeProfileLabel", () => {
  it("uses a real name and never the login email", () => {
    expect(
      officeProfileLabel({ name: "Muhajir", email: "muhajir@example.com" }),
    ).toBe("Muhajir");
    expect(
      officeProfileLabel({
        name: "muhajir@example.com",
        email: "muhajir@example.com",
      }),
    ).toBe("You");
    expect(officeProfileLabel({ name: "", email: "a@b.com" })).toBe("You");
    expect(officeProfileLabel(null)).toBe("You");
  });
});

describe("catalogHasRoom", () => {
  const rooms = [{ id: "room-group" }];
  const bots = [
    { id: "bot-1", homeRoomId: "home-1" },
    { id: "bot-legacy" },
  ];

  it("treats a group room as known", () => {
    expect(catalogHasRoom("room-group", rooms, bots)).toBe(true);
  });

  it("treats a person's home as known without rooms.list", () => {
    expect(catalogHasRoom("home-1", rooms, bots)).toBe(true);
  });

  it("treats a legacy bot id as the office room", () => {
    expect(catalogHasRoom("bot-legacy", rooms, bots)).toBe(true);
  });

  it("does not invent a missing room", () => {
    expect(catalogHasRoom("missing", rooms, bots)).toBe(false);
    expect(catalogHasRoom("home-1", [], [])).toBe(false);
  });
});

describe("unknownRoomRedirect", () => {
  const rooms = [{ id: "room-group" }];
  const bots = [
    { id: "bot-1", homeRoomId: "home-1" },
    { id: "bot-legacy" },
  ];

  it("stays on a known home room", () => {
    expect(
      unknownRoomRedirect({
        roomId: "home-1",
        workspaceSlug: "muhajir-5v6j44mv",
        rooms,
        bots,
      }),
    ).toBeNull();
  });

  it("opens a live desk when the URL room is gone", () => {
    expect(
      unknownRoomRedirect({
        roomId: "missing",
        workspaceSlug: "muhajir-5v6j44mv",
        rooms,
        bots,
      }),
    ).toEqual({
      to: "/$workspaceSlug/room/$roomId",
      params: { workspaceSlug: "muhajir-5v6j44mv", roomId: "home-1" },
    });
  });

  it("does not redirect to the same room id", () => {
    expect(
      unknownRoomRedirect({
        roomId: "ghost",
        workspaceSlug: "acme",
        rooms: [],
        bots: [{ id: "ghost" }],
      }),
    ).toBeNull();
  });

  it("opens the workspace when the office is empty", () => {
    expect(
      unknownRoomRedirect({
        roomId: "missing",
        workspaceSlug: "acme",
        rooms: [],
        bots: [],
      }),
    ).toEqual({
      to: "/$workspaceSlug",
      params: { workspaceSlug: "acme" },
    });
  });
});
