import { describe, expect, it } from "vitest";
import {
  CLOUD_API_ORIGIN,
  CLOUD_APP_ORIGIN,
  CLOUD_APP_SCHEME,
  CLOUD_LANDING_ORIGIN,
  CLOUD_WEB_ORIGIN,
  groxbotCookieDomain,
  knowledgeShareUrl,
  landingOriginForWeb,
  STAGING_API_ORIGIN,
  STAGING_LANDING_ORIGIN,
  STAGING_WEB_ORIGIN,
} from "./origins.js";

describe("cloud origins", () => {
  it("splits marketing, office, and API hosts", () => {
    expect(CLOUD_LANDING_ORIGIN).toBe("https://groxbot.com");
    expect(CLOUD_WEB_ORIGIN).toBe("https://app.groxbot.com");
    expect(CLOUD_API_ORIGIN).toBe("https://api.groxbot.com");
    expect(CLOUD_APP_SCHEME).toBe("groxbot");
    expect(CLOUD_APP_ORIGIN).toBe("groxbot://");
  });

  it("names workers.dev staging hosts", () => {
    expect(STAGING_LANDING_ORIGIN).toBe(
      "https://groxbot-landing.qalam.workers.dev",
    );
    expect(STAGING_WEB_ORIGIN).toBe("https://groxbot-web.qalam.workers.dev");
    expect(STAGING_API_ORIGIN).toBe("https://groxbot-api.qalam.workers.dev");
  });

  it("sets a parent cookie domain on groxbot.com hosts", () => {
    expect(groxbotCookieDomain(CLOUD_LANDING_ORIGIN)).toBe(".groxbot.com");
    expect(groxbotCookieDomain(CLOUD_WEB_ORIGIN)).toBe(".groxbot.com");
    expect(groxbotCookieDomain(CLOUD_API_ORIGIN)).toBe(".groxbot.com");
    expect(groxbotCookieDomain("http://127.0.0.1:5173")).toBeUndefined();
    expect(groxbotCookieDomain(STAGING_WEB_ORIGIN)).toBeUndefined();
  });

  it("points public knowledge links at the marketing host", () => {
    expect(landingOriginForWeb(CLOUD_WEB_ORIGIN)).toBe(CLOUD_LANDING_ORIGIN);
    expect(landingOriginForWeb(STAGING_WEB_ORIGIN)).toBe(STAGING_LANDING_ORIGIN);
    expect(landingOriginForWeb("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5174",
    );
    expect(knowledgeShareUrl(CLOUD_LANDING_ORIGIN, "ks-1")).toBe(
      "https://groxbot.com/s/ks-1",
    );
  });
});
