import { MAIL_CLOUDFLARE, MAIL_LOG } from "@groxbot/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareMailConfigured, createMailer, parseFrom } from "./mail.js";

describe("parseFrom", () => {
  it("keeps a bare address", () => {
    expect(parseFrom("noreply@groxbot.com")).toBe("noreply@groxbot.com");
  });

  it("splits display name", () => {
    expect(parseFrom("Groxbot <noreply@groxbot.com>")).toEqual({
      address: "noreply@groxbot.com",
      name: "Groxbot",
    });
  });
});

describe("createMailer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is log-only without the EMAIL binding", () => {
    expect(cloudflareMailConfigured({})).toBe(false);
    expect(createMailer({}).kind).toBe(MAIL_LOG);
    expect(
      cloudflareMailConfigured({
        emailFrom: "Groxbot <noreply@groxbot.com>",
      }),
    ).toBe(false);
  });

  it("refuses to log magic links in production", async () => {
    const mailer = createMailer({ production: true });
    await expect(
      mailer.sendMagicLink({ email: "a@b.com", url: "https://x" }),
    ).rejects.toThrow(/EMAIL Worker binding/);
  });

  it("sends through the Worker EMAIL binding", async () => {
    const send = vi.fn(async () => ({ messageId: "msg_1" }));
    const mailer = createMailer({
      emailFrom: "Groxbot <noreply@groxbot.com>",
      email: { send },
    });
    expect(mailer.kind).toBe(MAIL_CLOUDFLARE);
    await mailer.sendMagicLink({
      email: "you@example.com",
      url: "https://app.groxbot.com/api/auth/magic-link/verify?token=abc",
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "you@example.com",
      from: { email: "noreply@groxbot.com", name: "Groxbot" },
      subject: "Sign in to Groxbot",
    });
  });

  it("sends workspace invites through the binding", async () => {
    const send = vi.fn(async () => ({ messageId: "msg_2" }));
    const mailer = createMailer({
      emailFrom: "noreply@groxbot.com",
      email: { send },
    });
    await mailer.sendInvitation({
      email: "you@example.com",
      url: "https://app.groxbot.com/onboarding?invite=inv_abc",
      organizationName: "Acme",
      inviterName: "Sam",
    });
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "you@example.com",
      from: "noreply@groxbot.com",
      subject: "Join Acme on Groxbot",
    });
  });
});
