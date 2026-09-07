import { describe, expect, it } from "vitest";
import {
  GROXBOT_DEMO_URL,
  defaultWorkspaceName,
  onboardingFirstName,
  workspaceNeedsOnboarding,
} from "./onboarding";

describe("GROXBOT_DEMO_URL", () => {
  it("points at the founder Cal booking", () => {
    expect(GROXBOT_DEMO_URL).toBe(
      "https://cal.com/muhajirdev/groxbot-demo",
    );
  });
});

describe("defaultWorkspaceName", () => {
  it("uses a real name", () => {
    expect(
      defaultWorkspaceName({ name: "Muhajir", email: "muhajir@example.com" }),
    ).toBe("Muhajir");
  });

  it("does not use the login email as the office name", () => {
    expect(
      defaultWorkspaceName({
        name: "muhajir@example.com",
        email: "muhajir@example.com",
      }),
    ).toBe("Workspace");
    expect(defaultWorkspaceName({ name: "", email: "a@b.com" })).toBe(
      "Workspace",
    );
    expect(defaultWorkspaceName(null)).toBe("Workspace");
  });
});

describe("onboardingFirstName", () => {
  it("uses the first word of a real name", () => {
    expect(
      onboardingFirstName({ name: "Muhammad Ali", email: "a@b.com" }),
    ).toBe("Muhammad");
  });

  it("does not greet with the login email", () => {
    expect(
      onboardingFirstName({
        name: "muhajir@example.com",
        email: "muhajir@example.com",
      }),
    ).toBeNull();
    expect(onboardingFirstName({ name: "", email: "a@b.com" })).toBeNull();
  });
});

describe("workspaceNeedsOnboarding", () => {
  it("is true for an empty office", () => {
    expect(workspaceNeedsOnboarding([])).toBe(true);
  });

  it("ignores archived teammates", () => {
    expect(workspaceNeedsOnboarding([{ archivedAt: "2026-09-01" }])).toBe(
      true,
    );
    expect(
      workspaceNeedsOnboarding([
        { archivedAt: null },
        { archivedAt: "2026-09-01" },
      ]),
    ).toBe(false);
  });
});
