import { describe, expect, it } from "vitest";
import {
  clearRememberedInvite,
  invitationIdFromInput,
  inviteFromHref,
  readRememberedInvite,
  rememberInvite,
} from "./invite";

describe("inviteFromHref", () => {
  it("reads invite from an onboarding URL", () => {
    expect(
      inviteFromHref("http://127.0.0.1:5173/onboarding?invite=inv_abc"),
    ).toBe("inv_abc");
    expect(inviteFromHref("/onboarding?invite=inv_abc")).toBe("inv_abc");
  });

  it("returns nothing when the path has no invite", () => {
    expect(inviteFromHref("/onboarding")).toBeUndefined();
  });
});

describe("invitationIdFromInput", () => {
  it("accepts a raw id or a pasted link", () => {
    expect(invitationIdFromInput("inv_abc")).toBe("inv_abc");
    expect(invitationIdFromInput("groxbot://onboarding?invite=inv_abc")).toBe(
      "inv_abc",
    );
  });
});

describe("rememberInvite", () => {
  it("keeps the last pasted invite until join succeeds", () => {
    rememberInvite("inv_abc");
    expect(readRememberedInvite()).toBe("inv_abc");
    clearRememberedInvite();
    expect(readRememberedInvite()).toBe("");
  });
});
