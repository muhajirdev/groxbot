import {
  CLOUD_API_ORIGIN,
  CLOUD_LANDING_ORIGIN,
  CLOUD_WEB_ORIGIN,
  isGroxbotStagingOrigin,
  STAGING_API_ORIGIN,
  STAGING_LANDING_ORIGIN,
  STAGING_WEB_ORIGIN,
} from "@groxbot/contracts";

export const GROXBOT_NAME = "Groxbot";
export const GROXBOT_VERSION = "0.0.1";
export const GROXBOT_LANGUAGE = "en-US";
export const GROXBOT_LICENSE = "Groxbot License (Apache 2.0 plus conditions)";
export const GROXBOT_UPDATED = "2026-09-05";
export const GROXBOT_GITHUB = "https://github.com/muhajirdev/groxbot";
export const GROXBOT_EMAIL = "hello@groxbot.com";
export const GROXBOT_APP = CLOUD_WEB_ORIGIN;
/** Brand kicker. Do not lead public copy with this. */
export const GROXBOT_TAGLINE = "AI is better together";
/** One-sentence what. Lead homepage, meta, press, and discovery with this. */
export const GROXBOT_WHAT =
  "Named AI teammates you message like people. Each has a real computer. The whole team sits in one office.";
export const GROXBOT_SUMMARY = `${GROXBOT_WHAT} Self-host for your organization is free, or use groxbot.com. No workflow builder. Gmail, Slack, GitHub, and 1,000+ tools. Bring your own model keys. Hosted Groxbot for others is groxbot.com.`;

export interface DiscoveryOrigins {
  web: string;
  api: string;
  office?: string;
}

export function officeOrigin(origins: DiscoveryOrigins): string {
  return origins.office ?? GROXBOT_APP;
}

export function cloudOrigins(): DiscoveryOrigins {
  return {
    web: CLOUD_LANDING_ORIGIN,
    api: CLOUD_API_ORIGIN,
    office: GROXBOT_APP,
  };
}

export function stagingOrigins(): DiscoveryOrigins {
  return {
    web: STAGING_LANDING_ORIGIN,
    api: STAGING_API_ORIGIN,
    office: STAGING_WEB_ORIGIN,
  };
}

export function originsFromWeb(webOrigin: string): DiscoveryOrigins {
  try {
    const { hostname } = new URL(webOrigin);
    if (hostname === "groxbot.com" || hostname.endsWith(".groxbot.com")) {
      return cloudOrigins();
    }
    if (isGroxbotStagingOrigin(webOrigin)) {
      return stagingOrigins();
    }
  } catch {
    // fall through to local origins
  }
  return { web: webOrigin.replace(/\/$/, ""), api: "http://127.0.0.1:3100" };
}

export const GROXBOT_ALTERNATE_NAMES = [
  "Grox Bot",
  "Grok Bot (self-hostable)",
  "groxbot.com",
] as const;

export const GROXBOT_SERVICES = [
  "Named AI teammates (bots) you message like coworkers",
  "Each bot has a computer — Cloudflare Computer workspace on that teammate, not a separate desk",
  "Live docs, slides, and sheets as their own Durable Objects",
  "Shared office knowledge and skills — the organization improves",
  "oRPC product API for web, desktop, and mobile",
  "Plugins for Gmail, Slack, GitHub, and 1,000+ tools",
  "Bring-your-own model keys — Claude, GPT, Grok, Kimi, DeepSeek; not locked to one vendor",
  "Who is putting Bots to work is on the board — so the rest of the team starts",
  "Opt-in guest runtimes (Hermes or OpenClaw) that dial out to Groxbot",
] as const;

export const GROXBOT_NOT_SERVICES = [
  "A visual workflow builder or agent graph editor",
  "A Discord-style community product",
  "Hosted model inference you do not bring keys for",
  "A competing multi-tenant Groxbot cloud (that is groxbot.com)",
] as const;

export const GROXBOT_STACK = [
  "TypeScript, pnpm, Hono, React, Vite, TanStack Router",
  "Marketing, office SPA, and API: Cloudflare Workers",
  "oRPC contract in @groxbot/contracts, client in @groxbot/rpc",
  "Postgres + Drizzle for team data (Neon on hosted Cloudflare)",
  "Hosted brains: Pi on the home RoomActor (tests: ScriptedAgentRuntime)",
  "One wakeup queue per home room — Durable Object RoomActor",
  "Each bot’s computer is Cloudflare Computer workspace on that actor — not a computers table",
  "Better Auth (magic-link email, Google, GitHub)",
  "Live apps: docs / slides / sheets on AppRuntime Durable Objects",
] as const;
