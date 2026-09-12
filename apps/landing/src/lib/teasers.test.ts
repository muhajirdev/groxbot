import { describe, expect, it } from "vitest";
import { INTEGRATIONS } from "./integrations";
import {
  HOME_INTEGRATION_MARQUEE_LIMIT,
  HOME_INTEGRATIONS,
  homeIntegrationMarquee,
} from "./teasers";

describe("home integration marquee", () => {
  it("fills two rows from the live catalog, featured names first", () => {
    const { rows, total } = homeIntegrationMarquee();
    expect(total).toBe(INTEGRATIONS.length);
    expect(total).toBeGreaterThan(1000);
    expect(rows).toHaveLength(2);
    const slugs = rows.flat().map((item) => item.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBe(HOME_INTEGRATION_MARQUEE_LIMIT);
    expect(slugs.slice(0, HOME_INTEGRATIONS.length)).toEqual(
      HOME_INTEGRATIONS.map((item) => item.slug),
    );
    expect(rows[0]?.length).toBeGreaterThan(20);
    expect(rows[1]?.length).toBeGreaterThan(20);
    expect(rows.flat().every((item) => item.logo.length > 0)).toBe(true);
  });
});
