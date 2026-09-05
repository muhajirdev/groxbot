import { MAIL_CLOUDFLARE, MAIL_LOG } from "@groxbot/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cloudflareMailConfigured,
  createMailer,
  mailFrom,
  parseFrom,
  sendAwayOfficeMail,
} from "./mail.js";

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

  it("logs magic links in dev even when EMAIL is configured", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const send = vi.fn(async () => ({ messageId: "msg_1" }));
    const mailer = createMailer({
      emailFrom: "Groxbot <noreply@groxbot.com>",
      email: { send },
    });
    await mailer.sendMagicLink({
      email: "you@example.com",
      url: "https://app.groxbot.com/api/auth/magic-link/verify?token=abc",
    });
    expect(send).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith(
      "[groxbot] Magic link for you@example.com:\nhttps://app.groxbot.com/api/auth/magic-link/verify?token=abc",
    );
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

  it("does not call Function.bind on the EMAIL stub", async () => {
    const send = vi.fn(async () => ({ messageId: "msg_rpc" }));
    Object.defineProperty(send, "bind", {
      value() {
        throw new TypeError(
          'The RPC receiver does not implement the method "bind".',
        );
      },
    });
    const mailer = createMailer({
      emailFrom: "Groxbot <noreply@groxbot.com>",
      email: { send },
    });
    await mailer.sendMagicLink({
      email: "you@example.com",
      url: "https://app.groxbot.com/api/auth/magic-link/verify?token=abc",
    });
    expect(send).toHaveBeenCalledOnce();
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

describe("sendAwayOfficeMail", () => {
  it("sends from the bot name", async () => {
    expect(mailFrom("Groxbot <noreply@mail.groxbot.com>", "Reja")).toEqual({
      email: "noreply@mail.groxbot.com",
      name: "Reja",
    });
    const send = vi.fn(async () => ({ messageId: "msg_away" }));
    await sendAwayOfficeMail(
      {
        emailFrom: "Groxbot <noreply@mail.groxbot.com>",
        email: { send },
      },
      {
        to: "you@example.com",
        botName: "Reja",
        url: "https://app.groxbot.com/acme/room/room_1",
        excerpt: "Shortlist is in the thread.",
      },
    );
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "you@example.com",
      from: { email: "noreply@mail.groxbot.com", name: "Reja" },
      subject: "Reja finished",
    });
  });

  it("escapes excerpt HTML", async () => {
    const send = vi.fn(async () => undefined);
    await sendAwayOfficeMail(
      {
        emailFrom: "noreply@mail.groxbot.com",
        email: { send },
      },
      {
        to: "you@example.com",
        botName: "Reja",
        url: "https://app.groxbot.com/acme/room/room_1",
        excerpt: "<script>x</script>",
      },
    );
    expect(String(send.mock.calls[0]?.[0]?.html)).toContain(
      "&lt;script&gt;x&lt;/script&gt;",
    );
  });
});
