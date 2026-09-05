/** Cloudflare-only. Excluded from `tsc`. Connected Composio apps as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import {
  composioConfigured,
  createComposioGateway,
} from "@groxbot/adapters/edge";
import {
  type ConnectedPluginAccount,
  composioUserId,
  connectedAccountForTool,
  connectorRecord,
  connectorString,
  PluginError,
} from "@groxbot/core";

export type PluginsHost = {
  workspaceId: string;
  accounts: ConnectedPluginAccount[];
  apiKey: string;
};

export class PluginsConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly host: () => PluginsHost,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "plugins";
  }

  protected override instructions() {
    const toolkits = this.host()
      .accounts.map((row) => row.toolkit)
      .filter(Boolean);
    const listed = toolkits.length ? toolkits.join(", ") : "none yet";
    return [
      "Connected workspace plugins (Gmail, Slack, GitHub, and the rest of the Composio catalog).",
      `Authenticated toolkits: ${listed}.`,
      "Search for a tool slug first, then execute. Do not guess slugs.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      search: {
        description:
          'Search tools on connected plugins. Call plugins.search({ query: "send email" }). A query string is also accepted. Returns slugs for plugins.execute.',
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 200 },
          },
          required: ["query"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const query = stringArg(args, "query", true);
          const host = this.host();
          return this.gateway(host).search({
            userId: composioUserId(host.workspaceId),
            query,
            toolkits: host.accounts.map((row) => row.toolkit),
          });
        },
      },
      execute: {
        description:
          'Run a connected plugin tool. Call plugins.execute({ slug: "GMAIL_SEND_EMAIL", arguments: { ... } }). Use a slug from plugins.search.',
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", minLength: 1, maxLength: 120 },
            arguments: { type: "object", additionalProperties: true },
          },
          required: ["slug"],
        },
        execute: async (args) => {
          const slug = stringArg(args, "slug", true);
          const host = this.host();
          return this.gateway(host).execute({
            userId: composioUserId(host.workspaceId),
            slug,
            arguments: objectArg(args, "arguments"),
            connectedAccountId: connectedAccountForTool(slug, host.accounts),
          });
        },
      },
    };
  }

  private gateway(host: PluginsHost) {
    if (
      !composioConfigured({ COMPOSIO_API_KEY: host.apiKey }) ||
      host.accounts.length === 0
    ) {
      throw new PluginError("No connected plugins.");
    }
    return createComposioGateway({ COMPOSIO_API_KEY: host.apiKey });
  }
}

function stringArg(args: unknown, key: string, positional = false): string {
  const value = connectorString(args, key, positional);
  if (!value) throw new PluginError("Missing plugin argument.");
  return value;
}

function objectArg(args: unknown, key: string): Record<string, unknown> {
  const row = connectorRecord(args);
  const value = row?.[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      throw new PluginError("Plugin arguments must be an object.");
    }
  }
  return {};
}
