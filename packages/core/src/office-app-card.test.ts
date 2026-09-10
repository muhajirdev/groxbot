import { describe, expect, it } from "vitest";
import {
  officeAppCardFromMetadata,
  officeAppCardLine,
  officeStampAppTitle,
  parseOfficeAppCard,
  withOfficeAppCard,
} from "./office-app-card.js";

describe("office app card", () => {
  it("parses a stamped card from args or nested app", () => {
    expect(
      parseOfficeAppCard({
        appId: "app_1",
        templateId: "crm",
        title: "Acme",
      }),
    ).toEqual({ appId: "app_1", templateId: "crm", title: "Acme" });
    expect(
      parseOfficeAppCard({
        app: { id: "app_2", templateId: "slides", title: "Q3" },
      }),
    ).toEqual({ appId: "app_2", templateId: "slides", title: "Q3" });
    expect(parseOfficeAppCard({ title: "Nope" })).toBeNull();
  });

  it("keeps speaker metadata when attaching a card", () => {
    const next = withOfficeAppCard(
      { speaker: { botId: "b1", name: "Reja" } },
      { appId: "app_3", templateId: "docs", title: "Hiring plan" },
    );
    expect(next.speaker).toEqual({ botId: "b1", name: "Reja" });
    expect(officeAppCardFromMetadata(next)).toEqual({
      appId: "app_3",
      templateId: "docs",
      title: "Hiring plan",
    });
    expect(officeAppCardLine(officeAppCardFromMetadata(next)!)).toBe(
      "Doc · Hiring plan",
    );
    expect(officeStampAppTitle("game", "  ")).toBe("Tic-tac-toe");
    expect(officeStampAppTitle("crm", "Acme")).toBe("Acme");
    expect(officeStampAppTitle("app", "")).toBe("Untitled app");
    expect(parseOfficeAppCard({
      appId: "app_4",
      templateId: "app",
      title: "Todo",
    })).toEqual({ appId: "app_4", templateId: "app", title: "Todo" });
    expect(officeAppCardLine({ appId: "app_4", templateId: "app", title: "Todo" })).toBe(
      "App · Todo",
    );
  });
});
