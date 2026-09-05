import { describe, expect, it } from "vitest";
import { agentSocketHost, apiOrigin, landingOrigin, officeUrl } from "./host";

describe("apiOrigin", () => {
  it("talks to wrangler in local dev", () => {
    expect(apiOrigin()).toBe("http://127.0.0.1:3100");
  });
});

describe("agentSocketHost", () => {
  it("is the wrangler host", () => {
    expect(agentSocketHost()).toBe("127.0.0.1:3100");
  });
});

describe("officeUrl", () => {
  it("resolves against the Vite origin", () => {
    expect(officeUrl("/login")).toBe("http://127.0.0.1:5173/login");
    expect(officeUrl("/onboarding?invite=inv_1")).toBe(
      "http://127.0.0.1:5173/onboarding?invite=inv_1",
    );
  });
});

describe("landingOrigin", () => {
  it("points local office shares at the landing Vite server", () => {
    expect(landingOrigin()).toBe("http://127.0.0.1:5174");
  });
});
