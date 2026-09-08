import { describe, expect, it } from "vitest";
import {
  officeHiredBotProjection,
  officeMarketplaceHits,
  OfficeHireError,
  resolveOfficeHire,
} from "./office-hire.js";

describe("officeMarketplaceHits", () => {
  it("returns catalog ids the hire tool can pass", () => {
    const hits = officeMarketplaceHits({ query: "talent", limit: 5 });
    expect(hits.bots.length).toBeGreaterThan(0);
    expect(hits.bots[0]?.id).toBe("talent-scout");
    expect(hits.categories.length).toBeGreaterThan(0);
  });
});

describe("resolveOfficeHire", () => {
  it("fills identity from a marketplace package", () => {
    const hired = resolveOfficeHire({ marketplaceId: "talent-scout" });
    expect(hired.name).toBe("Talent Scout");
    expect(hired.marketplaceId).toBe("talent-scout");
    expect(hired.instructions).toMatch(/Talent Scout/);
  });

  it("rejects an unknown marketplace id", () => {
    expect(() => resolveOfficeHire({ marketplaceId: "not-a-bot" })).toThrow(
      OfficeHireError,
    );
  });

  it("hires a named teammate without a package", () => {
    const hired = resolveOfficeHire({
      name: "Lookout",
      title: "Night watch",
      instructions: "You are Lookout.",
    });
    expect(hired).toEqual({
      name: "Lookout",
      title: "Night watch",
      description: "",
      instructions: "You are Lookout.",
    });
  });

  it("requires a name when there is no marketplace id", () => {
    expect(() => resolveOfficeHire({})).toThrow(/marketplaceId/);
  });
});

describe("officeHiredBotProjection", () => {
  it("keeps a compact roster row and does not open the new office", () => {
    expect(
      officeHiredBotProjection({
        id: "bot_1",
        name: "Lookout",
        title: "",
        homeRoomId: "room_1",
      }),
    ).toMatchObject({
      id: "bot_1",
      name: "Lookout",
      homeRoomId: "room_1",
      hint: expect.stringMatching(/sidebar/),
    });
  });
});
