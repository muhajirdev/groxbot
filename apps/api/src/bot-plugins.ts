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
  pluginAccountsForTool,
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
    const listed = this.host()
      .accounts.map((row) =>
        row.visibility === "private" ? `${row.toolkit} (private)` : row.toolkit,
      )
      .filter(Boolean);
    return [
      "Connected workspace plugin accounts (Gmail, Slack, GitHub, Instagram, …).",
      listed.length
        ? `Accounts this teammate can use: ${listed.join(", ")}.`
        : "No accounts yet.",
      "Search for a tool slug first. If several accounts of the same app exist, pass account from search into execute.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      search: {
        description:
          'Search tools on connected plugin accounts. Call plugins.search({ query: "send email" }). A query string is also accepted. Returns slugs and account ids for plugins.execute.',
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
          const toolkits = [
            ...new Set(host.accounts.map((row) => row.toolkit)),
          ];
          const hits = await this.gateway(host).search({
            userId: composioUserId(host.workspaceId),
            query,
            toolkits,
          });
          return hits.map((hit) => {
            const accounts = pluginAccountsForTool(hit.slug, host.accounts).map(
              (row) => ({
                id: row.id,
                toolkit: row.toolkit,
                visibility: row.visibility,
              }),
            );
            return { ...hit, accounts };
          });
        },
      },
      execute: {
        description:
          'Run a connected plugin tool. Call plugins.execute({ slug: "GMAIL_SEND_EMAIL", arguments: { ... } }). If search listed several accounts, pass account (the id).',
        inputSchema: {
          type: "object",
          properties: {
            slug: { type: "string", minLength: 1, maxLength: 120 },
            arguments: { type: "object", additionalProperties: true },
            account: { type: "string", minLength: 1, maxLength: 80 },
          },
          required: ["slug"],
        },
        execute: async (args) => {
          const slug = stringArg(args, "slug", true);
          const account = connectorString(args, "account");
          const host = this.host();
          const connectedAccountId = connectedAccountForTool(
            slug,
            host.accounts,
            account,
          );
          if (!connectedAccountId) {
            const matches = pluginAccountsForTool(slug, host.accounts);
            if (matches.length > 1) {
              throw new PluginError(
                "Several accounts can run this tool. Pass account from plugins.search.",
              );
            }
            throw new PluginError("No connected account for that plugin tool.");
          }
          return this.gateway(host).execute({
            userId: composioUserId(host.workspaceId),
            slug,
            arguments: objectArg(args, "arguments"),
            connectedAccountId,
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
