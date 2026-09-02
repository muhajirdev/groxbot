import { describe, expect, it } from "vitest";
import {
  invitationIdFromInput,
  invitationUrl,
  renameWorkspace,
  slugForWorkspace,
  workspaceAuthMessage,
} from "./workspace.js";

describe("slugForWorkspace", () => {
  it("slugifies the name and appends a short salt", () => {
    expect(slugForWorkspace("Acme Labs", "user-12ab-34cd")).toBe(
      "acme-labs-user12ab",
    );
  });

  it("falls back when the name has no word characters", () => {
    expect(slugForWorkspace("!!!", "abc12345def")).toBe("workspace-abc12345");
  });
});

describe("invitationIdFromInput", () => {
  it("returns a bare id", () => {
    expect(invitationIdFromInput(" inv_abc ")).toBe("inv_abc");
  });

  it("pulls invite from an onboarding URL", () => {
    expect(
      invitationIdFromInput(
        "https://app.groxbot.com/onboarding?invite=inv_abc&x=1",
      ),
    ).toBe("inv_abc");
  });

  it("pulls invite from a login URL", () => {
    expect(
      invitationIdFromInput("https://app.groxbot.com/login?invite=inv_abc"),
    ).toBe("inv_abc");
  });

  it("pulls invite from a relative onboarding path", () => {
    expect(
      invitationIdFromInput("/onboarding?invite=inv_abc"),
    ).toBe("inv_abc");
  });
});

describe("invitationUrl", () => {
  it("builds an onboarding invite link", () => {
    expect(invitationUrl("https://app.groxbot.com/", "inv_abc")).toBe(
      "https://app.groxbot.com/onboarding?invite=inv_abc",
    );
  });
});

describe("renameWorkspace", () => {
  it("does not write a blank name", async () => {
    await expect(
      renameWorkspace({} as never, "ws_1", "   "),
    ).resolves.toBeNull();
  });
});

describe("workspaceAuthMessage", () => {
  it("rewrites recipient mismatches", () => {
    expect(
      workspaceAuthMessage(
        "You are not the recipient of the invitation",
        "Join failed",
      ),
    ).toBe("That invite is for a different email.");
  });

  it("rewrites organization update permission errors", () => {
    expect(
      workspaceAuthMessage(
        "You are not allowed to update this organization",
        "Could not update workspace",
      ),
    ).toBe("You can't rename this workspace.");
  });
});
