import {
  OPEN_INVITE_EMAIL,
  WorkspaceInviteLinkSchema,
  isOpenInvitationEmail,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  deleteOpenInvitation,
  getOpenInvitation,
  invitationIdFromInput,
  invitationUrl,
  isOwnerRole,
  officeRoomUrl,
  renameWorkspace,
  slugForWorkspace,
  workspaceAuthMessage,
} from "./workspace.js";

function inviteDb(
  existing: { id: string } | null,
  hooks?: { deleted?: () => void },
) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (existing ? [existing] : []),
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        hooks?.deleted?.();
      },
    }),
  } as never;
}

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

  it("pulls invite from the home invite URL", () => {
    expect(
      invitationIdFromInput("https://app.groxbot.com/?invite=inv_abc"),
    ).toBe("inv_abc");
  });
});

describe("invitationUrl", () => {
  it("builds a home invite link", () => {
    expect(invitationUrl("https://app.groxbot.com/", "inv_abc")).toBe(
      "https://app.groxbot.com/?invite=inv_abc",
    );
  });
});

describe("officeRoomUrl", () => {
  it("builds the 1:1 office link", () => {
    expect(
      officeRoomUrl("https://app.groxbot.com/", "acme-user12ab", "room_1"),
    ).toBe("https://app.groxbot.com/acme-user12ab/room/room_1");
  });
});

describe("isOwnerRole", () => {
  it("only treats owner as the office owner", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole(" Owner ")).toBe(true);
    expect(isOwnerRole("admin")).toBe(false);
    expect(isOwnerRole("member")).toBe(false);
    expect(isOwnerRole(null)).toBe(false);
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

describe("open invitation email", () => {
  it("marks the shareable-link sentinel", () => {
    expect(isOpenInvitationEmail(OPEN_INVITE_EMAIL)).toBe(true);
    expect(isOpenInvitationEmail("  Open-Invite@groxbot.invalid ")).toBe(true);
    expect(isOpenInvitationEmail("teammate@company.com")).toBe(false);
  });
});

describe("open invite link", () => {
  it("allows a missing shareable link", () => {
    expect(WorkspaceInviteLinkSchema.parse({ url: null })).toEqual({
      url: null,
    });
  });

  it("returns the live open invite", async () => {
    await expect(
      getOpenInvitation(inviteDb({ id: "inv_live" }), "ws_1"),
    ).resolves.toBe("inv_live");
    await expect(getOpenInvitation(inviteDb(null), "ws_1")).resolves.toBeNull();
  });

  it("deletes the pending open invite", async () => {
    let deleted = false;
    await deleteOpenInvitation(
      inviteDb({ id: "inv_live" }, { deleted: () => {
        deleted = true;
      } }),
      "ws_1",
    );
    expect(deleted).toBe(true);
  });
});
