import { describe, expect, it } from "vitest";
import { officeKnowledgeHref, officeKnowledgePath } from "./office-route";
import { officeSearch } from "./office-search";

describe("officeKnowledgePath", () => {
  it("opens the library on this note in the office", () => {
    const path = officeKnowledgePath(
      "acme",
      "room-1",
      "how-we-work/voice.md",
    );
    expect(path).toBe(
      "/acme/room/room-1?library=true&knowledge=how-we-work%2Fvoice.md",
    );
    const query = new URLSearchParams(path.split("?")[1]);
    expect(officeSearch(Object.fromEntries(query))).toEqual({
      library: true,
      knowledge: "how-we-work/voice.md",
    });
  });
});

describe("officeKnowledgeHref", () => {
  it("is an app.groxbot.com URL", () => {
    expect(
      officeKnowledgeHref({
        origin: "https://app.groxbot.com",
        workspaceSlug: "acme",
        roomId: "room-1",
        path: "briefs/q3.pdf",
      }),
    ).toBe(
      "https://app.groxbot.com/acme/room/room-1?library=true&knowledge=briefs%2Fq3.pdf",
    );
  });
});
