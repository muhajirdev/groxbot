import { describe, expect, it } from "vitest";
import { inviteFromHref } from "./invite";

describe("inviteFromHref", () => {
  it("reads invite from an absolute onboarding URL", () => {
    expect(
      inviteFromHref("http://127.0.0.1:5173/onboarding?invite=inv_abc"),
    ).toBe("inv_abc");
  });

  it("reads invite from a router path without an origin", () => {
    expect(inviteFromHref("/onboarding?invite=inv_abc")).toBe("inv_abc");
  });

  it("returns nothing when the path has no invite", () => {
    expect(inviteFromHref("/onboarding")).toBeUndefined();
    expect(inviteFromHref("")).toBeUndefined();
  });
});
