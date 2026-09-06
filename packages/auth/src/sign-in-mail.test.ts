import { describe, expect, it } from "vitest";
import { digitsOfOtp, signInMailCopy } from "./sign-in-mail";

describe("signInMailCopy", () => {
  it("puts the link and the code in one mail", () => {
    const copy = signInMailCopy({
      url: "https://api.groxbot.com/api/auth/magic-link/verify?token=abc",
      otp: "123456",
    });
    expect(copy.subject).toBe("Sign in to Groxbot");
    expect(copy.text).toContain("Open Groxbot:");
    expect(copy.text).toContain(
      "https://api.groxbot.com/api/auth/magic-link/verify?token=abc",
    );
    expect(copy.text).toContain("Or enter this code: 123456");
    expect(copy.html).toContain("Open Groxbot");
    expect(copy.html).toContain("<strong>123456</strong>");
  });

  it("still works with only a link", () => {
    const copy = signInMailCopy({ url: "https://x", otp: "" });
    expect(copy.text).toContain("https://x");
    expect(copy.text).not.toContain("code");
  });

  it("still works with only a code", () => {
    const copy = signInMailCopy({ otp: "654321" });
    expect(copy.text).toContain("Enter this code: 654321");
    expect(copy.text).not.toContain("Open Groxbot");
  });
});

describe("digitsOfOtp", () => {
  it("strips spaces and extra characters", () => {
    expect(digitsOfOtp("12 34-56")).toBe("123456");
    expect(digitsOfOtp("123456789")).toBe("123456");
  });
});
