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
  emailOTP,
  magicLink,
  organization as organizationPlugin,
} from "better-auth/plugins";
import {
  SIGN_IN_EXPIRES_SEC,
  SIGN_IN_OTP_LENGTH,
} from "./sign-in-mail.js";

export {
  digitsOfOtp,
  SIGN_IN_EXPIRES_SEC,
  SIGN_IN_OTP_LENGTH,
  signInMailCopy,
} from "./sign-in-mail.js";

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
      otp?: string;
      token?: string;
    }) => Promise<void> | void;
    sendInvitationEmail: (input: {
      email: string;
      url: string;
      organizationName: string;
      inviterName: string;
    }) => Promise<void> | void;
  },
) {
  const api: {
    current?: {
      createVerificationOTP: (args: {
        body: { email: string; type: "sign-in" };
      }) => Promise<unknown>;
    };
  } = {};
  const auth = betterAuth({
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
        expiresIn: SIGN_IN_EXPIRES_SEC,
        sendMagicLink: async ({ email, url, token }) => {
          let otp = "";
          try {
            const created = await api.current?.createVerificationOTP({
              body: { email, type: "sign-in" },
            });
            otp = otpFromCreated(created);
          } catch {
            // Link still goes out if OTP minting fails.
          }
          await opts.sendMagicLink({ email, url, otp, token });
        },
      }),
      emailOTP({
        otpLength: SIGN_IN_OTP_LENGTH,
        expiresIn: SIGN_IN_EXPIRES_SEC,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== "sign-in") return;
          await opts.sendMagicLink({ email, url: "", otp });
        },
      }),
    ],
  });
  api.current = auth.api;
  return auth;
}

function otpFromCreated(created: unknown): string {
  return typeof created === "string" && /^\d{4,8}$/.test(created) ? created : "";
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
