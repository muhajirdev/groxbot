import { expo } from "@better-auth/expo";
import type { Database } from "@groxbot/db";
import {
  account,
  invitation,
  member,
  organization,
  session,
  user,
  verification,
} from "@groxbot/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  magicLink,
  organization as organizationPlugin,
} from "better-auth/plugins";

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export function createAuth(
  db: Database,
  opts: {
    secret: string;
    baseURL: string;
    trustedOrigins: string[];
    cookieDomain?: string;
    google?: OAuthCredentials;
    github?: OAuthCredentials;
    webOrigin: string;
    sendMagicLink: (input: {
      email: string;
      url: string;
      token: string;
    }) => Promise<void> | void;
    sendInvitationEmail: (input: {
      email: string;
      url: string;
      organizationName: string;
      inviterName: string;
    }) => Promise<void> | void;
  },
) {
  return betterAuth({
    secret: opts.secret,
    baseURL: opts.baseURL,
    trustedOrigins: opts.trustedOrigins,
    advanced: cookieAdvanced(opts),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
        organization,
        member,
        invitation,
      },
    }),
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    socialProviders: {
      ...(opts.google
        ? {
            google: {
              clientId: opts.google.clientId,
              clientSecret: opts.google.clientSecret,
            },
          }
        : {}),
      ...(opts.github
        ? {
            github: {
              clientId: opts.github.clientId,
              clientSecret: opts.github.clientSecret,
              scope: ["read:user", "user:email"],
            },
          }
        : {}),
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        requireLocalEmailVerified: false,
      },
    },
    plugins: [
      expo(),
      organizationPlugin({
        sendInvitationEmail: async (data) => {
          const origin = opts.webOrigin.replace(/\/$/, "");
          await opts.sendInvitationEmail({
            email: data.email,
            url: `${origin}/onboarding?invite=${encodeURIComponent(data.id)}`,
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name || "A teammate",
          });
        },
      }),
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: opts.sendMagicLink,
      }),
    ],
  });
}

function hostnameOf(origin: string): string | undefined {
  try {
    return new URL(origin).hostname;
  } catch {
    return undefined;
  }
}

function cookieAdvanced(opts: {
  baseURL: string;
  webOrigin: string;
  cookieDomain?: string;
}) {
  const secureNone = {
    sameSite: "none" as const,
    secure: true,
  };
  if (opts.cookieDomain) {
    return {
      crossSubDomainCookies: {
        enabled: true,
        domain: opts.cookieDomain,
      },
      defaultCookieAttributes: secureNone,
    };
  }
  const authHost = hostnameOf(opts.baseURL);
  const webHost = hostnameOf(opts.webOrigin);
  if (authHost && webHost && authHost !== webHost) {
    return { defaultCookieAttributes: secureNone };
  }
  return undefined;
}

export type Auth = ReturnType<typeof createAuth>;
