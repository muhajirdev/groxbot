import { CLOUD_WEB_ORIGIN } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { INVITE_MAILTO } from "./copy.js";
import { resolveAppOrigin, startUrl } from "./app-url.js";

describe("resolveAppOrigin", () => {
  it("prefers an explicit Vite app URL", () => {
    expect(
      resolveAppOrigin({
        viteAppUrl: "http://127.0.0.1:5173/",
        prod: true,
      }),
    ).toBe("http://127.0.0.1:5173");
  });

  it("uses the cloud office in production", () => {
    expect(resolveAppOrigin({ prod: true })).toBe(CLOUD_WEB_ORIGIN);
  });

  it("uses local Vite in development", () => {
    expect(resolveAppOrigin({ prod: false })).toBe("http://127.0.0.1:5173");
  });
});

describe("startUrl", () => {
  it("emails for an invite", () => {
    expect(startUrl()).toBe(INVITE_MAILTO);
    expect(startUrl()).toBe("mailto:muhajir@expandra.ai");
  });
});

describe("resolveAppOrigin", () => {
  it("prefers an explicit Vite app URL", () => {
    expect(
      resolveAppOrigin({
        viteAppUrl: "http://127.0.0.1:5173/",
        prod: true,
      }),
    ).toBe("http://127.0.0.1:5173");
  });

  it("uses the cloud office in production", () => {
    expect(resolveAppOrigin({ prod: true })).toBe(CLOUD_WEB_ORIGIN);
  });

  it("uses local Vite in development", () => {
    expect(resolveAppOrigin({ prod: false })).toBe("http://127.0.0.1:5173");
  });
});
