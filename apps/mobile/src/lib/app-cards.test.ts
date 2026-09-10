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

  it("reads a stamp_app tool-call card", () => {
    expect(
      appCardsFromOfficeMessage({
        id: "m3",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolName: "stamp_app",
            args: { appId: "app_4", templateId: "slides", title: "Q3" },
          },
        ],
      }),
    ).toEqual([{ appId: "app_4", templateId: "slides", title: "Q3" }]);
  });

  it("reads a custom gadget card", () => {
    expect(
      appCardsFromOfficeMessage({
        id: "m4",
        role: "assistant",
        parts: [
          {
            type: "app",
            appId: "app_5",
            templateId: "app",
            title: "Todo",
          },
        ],
      }),
    ).toEqual([{ appId: "app_5", templateId: "app", title: "Todo" }]);
  });
});
