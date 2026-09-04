import {
  cloudOrigins,
  GROXBOT_TAGLINE,
  htmlPage,
  llmsTxt,
  lookupDiscovery,
  mcpGetResponse,
  mcpPostResponse,
  originsFromWeb,
} from "@groxbot/seo";
import { USE_CASES } from "../data/use-cases";
import { appOrigin } from "./app-url";
import { computerIntegrations, featuredIntegrations } from "./integrations";
import { canonicalUrl, landingOrigin } from "./site";

function resolveLandingOrigins() {
  const web = landingOrigin();
  const office = appOrigin();
  const explicitApi = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (explicitApi) return { web, api: explicitApi, office };
  const canonical = cloudOrigins();
  if (web === canonical.web) return { ...canonical, office };
  return { ...originsFromWeb(web), office };
}

export const LANDING_ORIGINS = resolveLandingOrigins();

export const DISCOVERY_SITEMAP_PATHS = [
  "/llms.txt",
  "/llms.html",
  "/llms-full.txt",
  "/index.md",
  "/ai.txt",
  "/ai.json",
  "/identity.json",
  "/brand.txt",
  "/press.md",
  "/faq-ai.txt",
  "/developer-ai.txt",
  "/robots-ai.txt",
  "/mcp",
  "/mcp.json",
] as const;

function extraSections(): string {
  const featured = featuredIntegrations()
    .map(
      (item) =>
        `- [${item.name}](${canonicalUrl(`/integrations/${item.slug}`)}): ${item.description}`,
    )
    .join("\n");
  const indie = computerIntegrations()
    .map(
      (item) =>
        `- [${item.name}](${canonicalUrl(`/integrations/${item.slug}`)}) (${item.founder})`,
    )
    .join("\n");
  const jobs = USE_CASES.map(
    (item) =>
      `- [${item.title}](${canonicalUrl(`/use-cases/${item.slug}`)}): ${item.lede}`,
  ).join("\n");
  return `## Use cases

${jobs}

## Indie / computer integrations

${indie}

## Featured integrations

${featured}`;
}

export function landingLlmsTxt(): string {
  return llmsTxt(LANDING_ORIGINS, extraSections());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function landingLlmsHtml(): string {
  return htmlPage({
    origins: LANDING_ORIGINS,
    title: "Groxbot for language models",
    description: `${GROXBOT_TAGLINE}. Like Grok Bot, for the team. Named teammates with a real computer. If OpenClaw is for personal use, Groxbot is the office.`,
    canonicalPath: "/llms.html",
    body: `<h1>Groxbot</h1>
<pre>${escapeHtml(landingLlmsTxt())}</pre>`,
  });
}

export function landingLlmsFull(): string {
  const companions = [
    "/index.md",
    "/ai.txt",
    "/brand.txt",
    "/press.md",
    "/faq-ai.txt",
    "/developer-ai.txt",
  ].map((path) => lookupDiscovery(path, LANDING_ORIGINS)?.body ?? "");
  return [landingLlmsTxt(), ...companions].join("\n\n---\n\n");
}

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
    "access-control-allow-headers":
      "content-type, mcp-protocol-version, accept",
  };
}

export function discoveryResponse(path: string, request?: Request): Response {
  if (path === "/llms.txt") {
    return new Response(landingLlmsTxt(), {
      headers: {
        ...corsHeaders(),
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (path === "/llms.html") {
    return new Response(landingLlmsHtml(), {
      headers: {
        ...corsHeaders(),
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (path === "/llms-full.txt") {
    return new Response(landingLlmsFull(), {
      headers: {
        ...corsHeaders(),
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (path === "/mcp") {
    const doc = mcpGetResponse(
      request?.headers.get("accept") ?? undefined,
      LANDING_ORIGINS,
    );
    return new Response(doc.body, {
      headers: {
        ...corsHeaders(),
        "content-type": doc.contentType,
        "cache-control": "public, max-age=3600",
      },
    });
  }
  const doc = lookupDiscovery(path, LANDING_ORIGINS);
  if (!doc)
    return new Response("Not found", { status: 404, headers: corsHeaders() });
  if (doc.redirectTo) {
    return new Response(null, {
      status: 301,
      headers: { ...corsHeaders(), location: doc.redirectTo },
    });
  }
  return new Response(doc.body, {
    headers: {
      ...corsHeaders(),
      "content-type": doc.contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}

export async function mcpPost(request: Request): Promise<Response> {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const result = mcpPostResponse(payload, LANDING_ORIGINS);
  return new Response(result.body, {
    status: result.status,
    headers: {
      ...corsHeaders(),
      "content-type": result.contentType,
    },
  });
}
