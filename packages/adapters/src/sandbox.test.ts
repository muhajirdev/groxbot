import { FAKE_SANDBOX } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { createSandboxProvider, FakeSandboxProvider } from "./sandbox.js";

describe("createSandboxProvider", () => {
  it("returns the fake provider", () => {
    expect(createSandboxProvider(FAKE_SANDBOX)).toBeInstanceOf(
      FakeSandboxProvider,
    );
  });

  it("knows docker, e2b, and desktop but does not implement them yet", () => {
    for (const kind of ["docker", "e2b", "desktop"] as const) {
      expect(() => createSandboxProvider(kind)).toThrow(/not implemented yet/);
    }
  });

  it("rejects unknown kinds", () => {
    expect(() => createSandboxProvider("cloudflare")).toThrow(
      /Unknown SANDBOX_PROVIDER/,
    );
  });
});
