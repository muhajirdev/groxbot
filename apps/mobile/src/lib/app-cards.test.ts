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
});
