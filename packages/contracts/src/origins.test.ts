import { describe, expect, it } from "vitest";
import {
  CLOUD_API_ORIGIN,
  CLOUD_APP_ORIGIN,
  CLOUD_APP_SCHEME,
  CLOUD_LANDING_ORIGIN,
  CLOUD_IOS_APP_ORIGIN,
  CLOUD_IOS_APP_SCHEME,
  CLOUD_WEB_ORIGIN,
  EXPO_DEV_CLIENT_ORIGIN,
  EXPO_GO_ORIGIN,
  groxbotCookieDomain,
  knowledgeShareUrl,
  landingOriginForWeb,
  LEGACY_API_ORIGIN,
  LEGACY_LANDING_ORIGIN,
  LEGACY_WEB_ORIGIN,
  STAGING_API_ORIGIN,
  STAGING_LANDING_ORIGIN,
  STAGING_WEB_ORIGIN,
} from "./origins.js";

describe("cloud origins", () => {
  it("splits marketing, office, and API hosts on whip.computer", () => {
    expect(CLOUD_LANDING_ORIGIN).toBe("https://whip.computer");
    expect(CLOUD_WEB_ORIGIN).toBe("https://app.whip.computer");
    expect(CLOUD_API_ORIGIN).toBe("https://api.whip.computer");
    expect(CLOUD_APP_SCHEME).toBe("groxbot");
    expect(CLOUD_APP_ORIGIN).toBe("groxbot://");
    expect(EXPO_GO_ORIGIN).toBe("exp://");
    expect(EXPO_DEV_CLIENT_ORIGIN).toBe("exp+groxbot://");
    expect(CLOUD_IOS_APP_SCHEME).toBe("groxbot-ios");
    expect(CLOUD_IOS_APP_ORIGIN).toBe("groxbot-ios://");
  });

  it("keeps groxbot.com as a legacy alias", () => {
    expect(LEGACY_LANDING_ORIGIN).toBe("https://groxbot.com");
    expect(LEGACY_WEB_ORIGIN).toBe("https://app.groxbot.com");
    expect(LEGACY_API_ORIGIN).toBe("https://api.groxbot.com");
  });

  it("names workers.dev staging hosts", () => {
    expect(STAGING_LANDING_ORIGIN).toBe(
      "https://groxbot-landing.qalam.workers.dev",
    );
    expect(STAGING_WEB_ORIGIN).toBe("https://groxbot-web.qalam.workers.dev");
    expect(STAGING_API_ORIGIN).toBe("https://groxbot-api.qalam.workers.dev");
  });

  it("sets a parent cookie domain on whip.computer and groxbot.com hosts", () => {
    expect(groxbotCookieDomain(CLOUD_LANDING_ORIGIN)).toBe(".whip.computer");
    expect(groxbotCookieDomain(CLOUD_WEB_ORIGIN)).toBe(".whip.computer");
    expect(groxbotCookieDomain(CLOUD_API_ORIGIN)).toBe(".whip.computer");
    expect(groxbotCookieDomain(LEGACY_WEB_ORIGIN)).toBe(".groxbot.com");
    expect(groxbotCookieDomain(LEGACY_API_ORIGIN)).toBe(".groxbot.com");
    expect(groxbotCookieDomain("http://127.0.0.1:5173")).toBeUndefined();
    expect(groxbotCookieDomain(STAGING_WEB_ORIGIN)).toBeUndefined();
  });

  it("points public knowledge links at the matching marketing host", () => {
    expect(landingOriginForWeb(CLOUD_WEB_ORIGIN)).toBe(CLOUD_LANDING_ORIGIN);
    expect(landingOriginForWeb(LEGACY_WEB_ORIGIN)).toBe(LEGACY_LANDING_ORIGIN);
    expect(landingOriginForWeb(STAGING_WEB_ORIGIN)).toBe(STAGING_LANDING_ORIGIN);
    expect(landingOriginForWeb("http://127.0.0.1:5173")).toBe(
      "http://127.0.0.1:5174",
    );
    expect(knowledgeShareUrl(CLOUD_LANDING_ORIGIN, "ks-1")).toBe(
      "https://whip.computer/s/ks-1",
    );
  });
});
