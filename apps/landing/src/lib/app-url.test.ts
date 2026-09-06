import { CLOUD_API_ORIGIN, CLOUD_WEB_ORIGIN } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { resolveApiOrigin, resolveAppOrigin } from "./app-url.js";

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

describe("resolveApiOrigin", () => {
  it("posts access requests at the Worker in production", () => {
    expect(resolveApiOrigin({ prod: true })).toBe(CLOUD_API_ORIGIN);
  });

  it("posts access requests at local wrangler in development", () => {
    expect(resolveApiOrigin({ prod: false })).toBe("http://127.0.0.1:3100");
  });
});
