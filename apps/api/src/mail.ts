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

export function createMailer(env: MailEnv): Mailer {
  const send = env.email?.send.bind(env.email);
  const fromRaw = env.emailFrom?.trim() ?? "";
  if (send && fromRaw) {
    const from = bindingFrom(fromRaw);
    return {
      kind: MAIL_CLOUDFLARE,
      sendMagicLink: async ({ email, url }) => {
        await send({
          to: email,
          from,
          subject: "Sign in to Groxbot",
          text: `Sign in to Groxbot:\n${url}\n\nThis link expires in 15 minutes.`,
          html: `<p>Sign in to Groxbot.</p><p><a href="${url}">Open Groxbot</a></p><p>This link expires in 15 minutes.</p>`,
        });
      },
      sendInvitation: async ({ email, url, organizationName, inviterName }) => {
        await send({
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
      console.info(`[groxbot] Magic link for ${email}:\n${url}`);
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
