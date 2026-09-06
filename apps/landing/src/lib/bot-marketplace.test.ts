import { BOT_MARKETPLACE_CATALOG } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { LANDING_HIRE_BOTS } from "./bot-marketplace";

describe("LANDING_HIRE_BOTS", () => {
  it("is the shared contracts marketplace catalog", () => {
    expect(LANDING_HIRE_BOTS).toBe(BOT_MARKETPLACE_CATALOG);
    expect(LANDING_HIRE_BOTS.length).toBeGreaterThan(0);
    expect(LANDING_HIRE_BOTS.some((row) => row.name === "Chief of Staff")).toBe(
      true,
    );
  });
});
