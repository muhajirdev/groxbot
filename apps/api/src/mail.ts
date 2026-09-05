import { MAIL_CLOUDFLARE, MAIL_LOG, type MailKind } from "@groxbot/contracts";

export type { MailKind };

export interface SendEmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string } | undefined>;
}

export interface MailEnv {
  production?: boolean;
  emailFrom?: string;
  emailBinding?: boolean;
  email?: SendEmailBinding;
}

export interface Mailer {
  kind: MailKind;
  sendMagicLink: (input: { email: string; url: string }) => Promise<void>;
  sendInvitation: (input: {
    email: string;
    url: string;
    organizationName: string;
    inviterName: string;
  }) => Promise<void>;
}

export function cloudflareMailConfigured(env: MailEnv): boolean {
  return Boolean((env.email || env.emailBinding) && env.emailFrom?.trim());
}

export function parseFrom(
  value: string,
): string | { address: string; name: string } {
  const match = value.trim().match(/^(.*)<([^>]+)>$/);
  if (!match) return value.trim();
  const name = match[1]?.trim().replace(/^"|"$/g, "") ?? "";
  const address = match[2]?.trim() ?? "";
  if (!address) return value.trim();
  return name ? { address, name } : address;
}

function bindingFrom(value: string): string | { email: string; name?: string } {
  const parsed = parseFrom(value);
  if (typeof parsed === "string") return parsed;
  return parsed.name
    ? { email: parsed.address, name: parsed.name }
    : parsed.address;
}

function logMagicLinkDev(env: MailEnv, email: string, url: string) {
  if (env.production) return;
  console.info(`[groxbot] Magic link for ${email}:\n${url}`);
}

export function createMailer(env: MailEnv): Mailer {
  const binding = env.email;
  const fromRaw = env.emailFrom?.trim() ?? "";
  if (binding && fromRaw) {
    const from = bindingFrom(fromRaw);
    return {
      kind: MAIL_CLOUDFLARE,
      sendMagicLink: async ({ email, url }) => {
        logMagicLinkDev(env, email, url);
        await binding.send({
          to: email,
          from,
          subject: "Sign in to Groxbot",
          text: `Sign in to Groxbot:\n${url}\n\nThis link expires in 15 minutes.`,
          html: `<p>Sign in to Groxbot.</p><p><a href="${url}">Open Groxbot</a></p><p>This link expires in 15 minutes.</p>`,
        });
      },
      sendInvitation: async ({ email, url, organizationName, inviterName }) => {
        await binding.send({
          to: email,
          from,
          subject: `Join ${organizationName} on Groxbot`,
          text: `${inviterName} invited you to ${organizationName} on Groxbot.\n${url}\n\nThis invite expires in 48 hours.`,
          html: `<p>${inviterName} invited you to ${organizationName} on Groxbot.</p><p><a href="${url}">Join the workspace</a></p><p>This invite expires in 48 hours.</p>`,
        });
      },
    };
  }
  return {
    kind: MAIL_LOG,
    sendMagicLink: async ({ email, url }) => {
      requireMailInProduction(env);
      logMagicLinkDev(env, email, url);
    },
    sendInvitation: async ({ email, url, organizationName, inviterName }) => {
      requireMailInProduction(env);
      console.info(
        `[groxbot] Invite ${email} to ${organizationName} (from ${inviterName}):\n${url}`,
      );
    },
  };
}

function requireMailInProduction(env: MailEnv) {
  if (env.production) {
    throw new Error(
      "Email sign-in needs the EMAIL Worker binding and EMAIL_FROM.",
    );
  }
}

export function mailFrom(
  emailFrom: string,
  displayName?: string,
): string | { email: string; name?: string } {
  const parsed = parseFrom(emailFrom);
  const address = typeof parsed === "string" ? parsed : parsed.address;
  const name = displayName?.trim();
  if (name && address) return { email: address, name };
  return bindingFrom(emailFrom);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Teammate ping after a long office turn. Not a digest. */
export async function sendAwayOfficeMail(
  env: MailEnv,
  input: {
    to: string;
    botName: string;
    url: string;
    excerpt?: string;
  },
): Promise<void> {
  const fromRaw = env.emailFrom?.trim() ?? "";
  const to = input.to.trim();
  const url = input.url.trim();
  const botName = input.botName.trim() || "Your teammate";
  if (!to || !url || !fromRaw) return;
  const excerpt = input.excerpt?.trim() ?? "";
  const subject = `${botName} finished`;
  const text = excerpt
    ? `${excerpt}\n\nOpen the office:\n${url}`
    : `I'm done in the office.\n\n${url}`;
  const html = excerpt
    ? `<p>${escapeHtml(excerpt)}</p><p><a href="${url}">Open the office</a></p>`
    : `<p>I'm done in the office.</p><p><a href="${url}">Open the office</a></p>`;
  if (env.email) {
    await env.email.send({
      to,
      from: mailFrom(fromRaw, botName),
      subject,
      text,
      html,
    });
    return;
  }
  console.info(`[groxbot] ${botName} finished for ${to}:\n${url}`);
}
