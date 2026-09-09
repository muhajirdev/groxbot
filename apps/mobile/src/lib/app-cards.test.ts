import { describe, expect, it } from "vitest";
import { appCardsFromOfficeMessage } from "./app-cards";

describe("appCardsFromOfficeMessage", () => {
  it("reads a stamped app part from the office transcript", () => {
    expect(
      appCardsFromOfficeMessage({
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "app",
            appId: "app_1",
            templateId: "docs",
            title: "Q3 notes",
          },
        ],
      }),
    ).toEqual([{ appId: "app_1", templateId: "docs", title: "Q3 notes" }]);
  });

  it("reads CRM and game cards", () => {
    expect(
      appCardsFromOfficeMessage({
        id: "m2",
        role: "assistant",
        parts: [
          {
            type: "app",
            appId: "app_2",
            templateId: "crm",
            title: "Acme",
          },
          {
            type: "app",
            appId: "app_3",
            templateId: "game",
            title: "Duel",
          },
        ],
      }),
    ).toEqual([
      { appId: "app_2", templateId: "crm", title: "Acme" },
      { appId: "app_3", templateId: "game", title: "Duel" },
    ]);
  });
});
