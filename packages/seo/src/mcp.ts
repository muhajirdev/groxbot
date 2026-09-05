import { identityJson, llmsTxt } from "./documents.js";
import {
  type DiscoveryOrigins,
  GROXBOT_ICON_PATH,
  GROXBOT_NAME,
  GROXBOT_SUMMARY,
  GROXBOT_UPDATED,
  GROXBOT_VERSION,
} from "./identity.js";

const PROTOCOL_VERSION = "2025-03-26";

export interface McpDocument {
  body: string;
  contentType: string;
  redirectTo?: string;
}

export function mcpServerCard(
  origins: DiscoveryOrigins,
): Record<string, unknown> {
  return {
    $schema:
      "https://static.modelcontextprotocol.io/schemas/mcp-server-card.json",
    version: "1.0.0",
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: {
      name: "io.groxbot/docs",
      title: `${GROXBOT_NAME} docs`,
      version: GROXBOT_VERSION,
      description: GROXBOT_SUMMARY,
    },
    transport: {
      type: "streamable-http",
      endpoint: `${origins.web.replace(/\/$/, "")}/mcp`,
    },
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    },
    authentication: {
      required: false,
      schemes: [],
    },
    websiteUrl: `${origins.web.replace(/\/$/, "")}/`,
    icons: [
      {
        src: `${origins.web.replace(/\/$/, "")}${GROXBOT_ICON_PATH}`,
        mimeType: "image/png",
        sizes: ["512x512"],
      },
      {
        src: `${origins.web.replace(/\/$/, "")}/favicon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["any"],
      },
    ],
    lastUpdated: GROXBOT_UPDATED,
  };
}

export function apiCatalog(origins: DiscoveryOrigins): Record<string, unknown> {
  const web = origins.web.replace(/\/$/, "");
  const api = origins.api.replace(/\/$/, "");
  return {
    linkset: [
      {
        anchor: `${web}/`,
        item: [
          { href: `${web}/mcp`, type: "application/json" },
          { href: `${web}/.well-known/mcp.json`, type: "application/json" },
          { href: `${api}/rpc`, type: "application/json" },
          { href: `${api}/health`, type: "application/json" },
          { href: `${web}/llms.txt`, type: "text/plain" },
        ],
      },
    ],
  };
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function mimeOf(contentType: string): string {
  return contentType.split(";")[0] ?? contentType;
}

function resources(origins: DiscoveryOrigins, docs: Map<string, McpDocument>) {
  const prefix = origins.web.replace(/\/$/, "");
  return [...docs.entries()]
    .filter(([, doc]) => !doc.redirectTo)
    .map(([path, doc]) => ({
      uri: `${prefix}${path}`,
      name: path,
      mimeType: mimeOf(doc.contentType),
    }));
}

function tools() {
  return [
    {
      name: "get_product_info",
      description: "Return the canonical Groxbot llms.txt identity document.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "get_identity",
      description: "Return structured Groxbot identity.json.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

function handleMethod(
  method: string,
  params: unknown,
  origins: DiscoveryOrigins,
  docs: Map<string, McpDocument>,
): unknown {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "io.groxbot/docs",
          version: GROXBOT_VERSION,
        },
        instructions:
          "Public Groxbot docs MCP. Use resources for discovery files. Private workspaces are not exposed.",
      };
    case "ping":
      return {};
    case "resources/list":
      return { resources: resources(origins, docs) };
    case "resources/read": {
      const uri =
        params && typeof params === "object" && "uri" in params
          ? String((params as { uri: unknown }).uri)
          : "";
      const prefix = origins.web.replace(/\/$/, "");
      const path = uri.startsWith(prefix)
        ? uri.slice(prefix.length) || "/"
        : "";
      const doc = docs.get(path);
      if (!doc || doc.redirectTo) {
        throw Object.assign(new Error(`Unknown resource: ${uri}`), {
          code: -32002,
        });
      }
      return {
        contents: [
          {
            uri,
            mimeType: mimeOf(doc.contentType),
            text: doc.body,
          },
        ],
      };
    }
    case "tools/list":
      return { tools: tools() };
    case "prompts/list":
      return { prompts: [] };
    case "tools/call": {
      const name =
        params && typeof params === "object" && "name" in params
          ? String((params as { name: unknown }).name)
          : "";
      if (name === "get_product_info") {
        return { content: [{ type: "text", text: llmsTxt(origins) }] };
      }
      if (name === "get_identity") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(identityJson(origins), null, 2),
            },
          ],
        };
      }
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
    }
    default:
      throw Object.assign(new Error(`Method not found: ${method}`), {
        code: -32601,
      });
  }
}

export function handleMcpRpc(
  payload: unknown,
  origins: DiscoveryOrigins,
  docs: Map<string, McpDocument>,
): { status: 200 | 202; body: JsonRpcResponse | JsonRpcResponse[] | null } {
  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: JsonRpcResponse[] = [];
  for (const raw of messages) {
    const request = (raw ?? {}) as JsonRpcRequest;
    if (request.method?.startsWith("notifications/")) continue;
    const id = request.id ?? null;
    try {
      const result = handleMethod(
        String(request.method ?? ""),
        request.params,
        origins,
        docs,
      );
      responses.push({ jsonrpc: "2.0", id, result });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? Number((error as { code: unknown }).code)
          : -32603;
      responses.push({
        jsonrpc: "2.0",
        id,
        error: {
          code,
          message: error instanceof Error ? error.message : "Internal error",
        },
      });
    }
  }
  if (responses.length === 0) return { status: 202, body: null };
  return {
    status: 200,
    body: Array.isArray(payload) ? responses : (responses[0] ?? null),
  };
}

export function jsonBody(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
