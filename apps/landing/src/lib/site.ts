import { CLOUD_LANDING_ORIGIN } from "@groxbot/contracts";
import {
  GROXBOT_APPLE_TOUCH_ICON_PATH,
  GROXBOT_FAVICON_PATH,
  GROXBOT_ICON_PATH,
  GROXBOT_OG_ALT,
  GROXBOT_OG_HEIGHT,
  GROXBOT_OG_PATH,
  GROXBOT_OG_TYPE,
  GROXBOT_OG_WIDTH,
  GROXBOT_TAGLINE,
  GROXBOT_THEME_COLOR,
} from "@groxbot/seo";

export const SITE_NAME = "Groxbot";
export const DEFAULT_TITLE = `${SITE_NAME} — ${GROXBOT_TAGLINE}`;
export const DEFAULT_DESCRIPTION = `${GROXBOT_TAGLINE}. Like Grok Bot, for the team. Named teammates, each with a computer, open source. Self-host for your team.`;

const LOCAL_LANDING_ORIGIN = "http://127.0.0.1:5174";

export function resolveLandingOrigin(env: {
  viteLandingUrl?: string;
  prod: boolean;
}): string {
  const explicit = env.viteLandingUrl?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (env.prod) return CLOUD_LANDING_ORIGIN;
  return LOCAL_LANDING_ORIGIN;
}

export function landingOrigin(): string {
  return resolveLandingOrigin({
    viteLandingUrl: import.meta.env.VITE_LANDING_URL,
    prod: import.meta.env.PROD,
  });
}

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return landingOrigin();
  return `${landingOrigin()}${normalized.replace(/\/$/, "")}`;
}

export type SeoInput = {
  title: string;
  description: string;
  path: string;
  jsonLd?: unknown[];
  robots?: string;
};

export function seoHead(input: SeoInput): {
  meta: Array<Record<string, string>>;
  links: Array<{ rel: string; href: string; type?: string; sizes?: string }>;
  scripts?: Array<{ type: string; children: string }>;
} {
  const url = canonicalUrl(input.path);
  const image = canonicalUrl(GROXBOT_OG_PATH);
  const title = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} — ${SITE_NAME}`;
  const description = input.description.slice(0, 160);
  const robots = input.robots ?? "index, follow, max-image-preview:large";
  const indexable = !/\bnoindex\b/i.test(robots);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { name: "theme-color", content: GROXBOT_THEME_COLOR },
      { name: "color-scheme", content: "dark" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: image },
      { property: "og:image:secure_url", content: image },
      { property: "og:image:type", content: GROXBOT_OG_TYPE },
      { property: "og:image:width", content: String(GROXBOT_OG_WIDTH) },
      { property: "og:image:height", content: String(GROXBOT_OG_HEIGHT) },
      { property: "og:image:alt", content: GROXBOT_OG_ALT },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: GROXBOT_OG_ALT },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "image_src", href: image },
      {
        rel: "icon",
        href: GROXBOT_FAVICON_PATH,
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: GROXBOT_ICON_PATH,
        type: "image/png",
        sizes: "512x512",
      },
      {
        rel: "apple-touch-icon",
        href: GROXBOT_APPLE_TOUCH_ICON_PATH,
        sizes: "180x180",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
        type: "application/manifest+json",
      },
      ...(indexable
        ? [
            {
              rel: "describedby",
              href: canonicalUrl("/llms.txt"),
              type: "text/plain",
            },
            {
              rel: "alternate",
              href: canonicalUrl("/index.md"),
              type: "text/markdown",
            },
          ]
        : []),
    ],
    scripts: input.jsonLd?.map((node) => ({
      type: "application/ld+json",
      children: JSON.stringify(node),
    })),
  };
}
