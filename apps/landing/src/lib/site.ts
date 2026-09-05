import { CLOUD_LANDING_ORIGIN } from "@groxbot/contracts";
import { GROXBOT_WHAT } from "@groxbot/seo";

export const SITE_NAME = "Groxbot";
export const DEFAULT_TITLE = `${SITE_NAME} — named AI teammates with a computer`;
export const DEFAULT_DESCRIPTION = `${GROXBOT_WHAT} Self-host, or use groxbot.com.`;

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
};

export function seoHead(input: SeoInput): {
  meta: Array<Record<string, string>>;
  links: Array<{ rel: string; href: string; type?: string }>;
  scripts?: Array<{ type: string; children: string }>;
} {
  const url = canonicalUrl(input.path);
  const title = input.title.includes(SITE_NAME)
    ? input.title
    : `${input.title} — ${SITE_NAME}`;
  const description = input.description.slice(0, 160);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [
      { rel: "canonical", href: url },
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
    ],
    scripts: input.jsonLd?.map((node) => ({
      type: "application/ld+json",
      children: JSON.stringify(node),
    })),
  };
}
