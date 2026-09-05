import {
  aiJson,
  aiTxt,
  brandTxt,
  developerAiTxt,
  faqAiTxt,
  identityJson,
  indexMarkdown,
  llmsFullTxt,
  llmsHtml,
  llmsTxt,
  mcpHtml,
  robotsAiTxt,
  robotsTxt,
  sitemapXml,
} from "./documents.js";
import { type DiscoveryOrigins, GROXBOT_OG_PATH } from "./identity.js";
import {
  apiCatalog,
  handleMcpRpc,
  jsonBody,
  type McpDocument,
  mcpServerCard,
} from "./mcp.js";
import { pressMarkdown } from "./press.js";

export const TEXT_PLAIN = "text/plain; charset=utf-8";
export const TEXT_MARKDOWN = "text/markdown; charset=utf-8";
export const TEXT_HTML = "text/html; charset=utf-8";
export const APPLICATION_JSON = "application/json; charset=utf-8";
export const APPLICATION_XML = "application/xml; charset=utf-8";
export const APPLICATION_LINKSET = "application/linkset+json; charset=utf-8";

export interface DiscoveryDocument extends McpDocument {
  path: string;
}

export function discoveryDocuments(
  origins: DiscoveryOrigins,
): DiscoveryDocument[] {
  const card = jsonBody(mcpServerCard(origins));
  const files: DiscoveryDocument[] = [
    { path: "/llms.txt", contentType: TEXT_PLAIN, body: llmsTxt(origins) },
    {
      path: "/llm.txt",
      contentType: TEXT_PLAIN,
      body: "",
      redirectTo: "/llms.txt",
    },
    { path: "/llms.html", contentType: TEXT_HTML, body: llmsHtml(origins) },
    {
      path: "/llms-full.txt",
      contentType: TEXT_PLAIN,
      body: llmsFullTxt(origins),
    },
    { path: "/ai.txt", contentType: TEXT_PLAIN, body: aiTxt(origins) },
    {
      path: "/ai.json",
      contentType: APPLICATION_JSON,
      body: jsonBody(aiJson(origins)),
    },
    {
      path: "/identity.json",
      contentType: APPLICATION_JSON,
      body: jsonBody(identityJson(origins)),
    },
    { path: "/brand.txt", contentType: TEXT_PLAIN, body: brandTxt(origins) },
    {
      path: "/press.md",
      contentType: TEXT_MARKDOWN,
      body: pressMarkdown(origins),
    },
    { path: "/faq-ai.txt", contentType: TEXT_PLAIN, body: faqAiTxt(origins) },
    {
      path: "/developer-ai.txt",
      contentType: TEXT_PLAIN,
      body: developerAiTxt(origins),
    },
    {
      path: "/robots-ai.txt",
      contentType: TEXT_PLAIN,
      body: robotsAiTxt(origins),
    },
    { path: "/robots.txt", contentType: TEXT_PLAIN, body: robotsTxt(origins) },
    {
      path: "/sitemap.xml",
      contentType: APPLICATION_XML,
      body: sitemapXml(origins),
    },
    {
      path: "/index.md",
      contentType: TEXT_MARKDOWN,
      body: indexMarkdown(origins),
    },
    { path: "/mcp.json", contentType: APPLICATION_JSON, body: card },
    {
      path: "/.well-known/mcp.json",
      contentType: APPLICATION_JSON,
      body: card,
    },
    { path: "/.well-known/mcp", contentType: APPLICATION_JSON, body: card },
    {
      path: "/.well-known/mcp/server-card.json",
      contentType: APPLICATION_JSON,
      body: card,
    },
    {
      path: "/.well-known/api-catalog",
      contentType: APPLICATION_LINKSET,
      body: jsonBody(apiCatalog(origins)),
    },
  ];
  return files;
}

export function discoveryDocumentMap(
  origins: DiscoveryOrigins,
): Map<string, DiscoveryDocument> {
  return new Map(discoveryDocuments(origins).map((doc) => [doc.path, doc]));
}

export function normalizeDiscoveryPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function lookupDiscovery(
  pathname: string,
  origins: DiscoveryOrigins,
): DiscoveryDocument | undefined {
  return discoveryDocumentMap(origins).get(normalizeDiscoveryPath(pathname));
}

export function discoveryLinkHeader(origins: DiscoveryOrigins): string {
  const web = origins.web.replace(/\/$/, "");
  return [
    `<${web}/llms.txt>; rel="describedby"; type="text/plain"`,
    `<${web}/index.md>; rel="alternate"; type="text/markdown"`,
    `<${web}/.well-known/mcp.json>; rel="describedby"; type="application/json"`,
    `<${web}${GROXBOT_OG_PATH}>; rel="preview"; type="image/png"`,
  ].join(", ");
}

export function mcpGetResponse(
  accept: string | undefined,
  origins: DiscoveryOrigins,
): DiscoveryDocument {
  if (accept?.includes("application/json")) {
    return {
      path: "/mcp",
      contentType: APPLICATION_JSON,
      body: jsonBody(mcpServerCard(origins)),
    };
  }
  return {
    path: "/mcp",
    contentType: TEXT_HTML,
    body: mcpHtml(origins),
  };
}

export function mcpPostResponse(
  payload: unknown,
  origins: DiscoveryOrigins,
): { status: 200 | 202; contentType: string; body: string } {
  const result = handleMcpRpc(payload, origins, discoveryDocumentMap(origins));
  if (result.body == null) {
    return { status: result.status, contentType: APPLICATION_JSON, body: "" };
  }
  return {
    status: result.status,
    contentType: APPLICATION_JSON,
    body: jsonBody(result.body),
  };
}

export const ADF_COMPLETE_PATHS = [
  "/llms.txt",
  "/llm.txt",
  "/llms.html",
  "/ai.txt",
  "/ai.json",
  "/identity.json",
  "/brand.txt",
  "/faq-ai.txt",
  "/developer-ai.txt",
  "/robots-ai.txt",
] as const;
