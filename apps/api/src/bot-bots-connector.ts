/** Cloudflare-only. Excluded from `tsc`. Roster hire as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import { connectorString } from "@groxbot/core";

export type BotsHost = {
  listTeammates(): Promise<
    Array<{ id: string; name: string; title: string; homeRoomId: string }>
  >;
  searchMarketplace(input: {
    query?: string;
    category?: string;
    limit?: number;
  }): Promise<unknown>;
  hireTeammate(input: {
    name?: string;
    title?: string;
    description?: string;
    instructions?: string;
    marketplaceId?: string;
  }): Promise<unknown>;
};

export class BotsConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly host: () => BotsHost,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "bots";
  }

  protected override instructions() {
    return [
      "Workspace roster — hire a new teammate onto this office.",
      "Search the curated marketplace with bots.search, then bots.hire({ marketplaceId }) — hire needs approval.",
      "Or hire({ name, title, instructions }) for a custom person. They land on the sidebar; empty desk until the human writes.",
      "Not Plugins and not the Skills store.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      list: {
        description:
          "List teammates already on this workspace roster (id, name, title). Not archived.",
        inputSchema: { type: "object", properties: {} },
        replay: "reexecute",
        execute: async () => ({ bots: await this.host().listTeammates() }),
      },
      search: {
        description:
          "Search the curated hire marketplace. Call bots.search({ query }) or pass a query string. Returns id, name, blurb — then hire by marketplaceId.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", maxLength: 200 },
            category: { type: "string", maxLength: 80 },
            limit: { type: "integer", minimum: 1, maximum: 20 },
          },
        },
        replay: "reexecute",
        execute: async (args) =>
          this.host().searchMarketplace({
            query: optionalString(args, "query", true) ?? "",
            category: optionalString(args, "category"),
            limit: numberArg(args, "limit"),
          }),
      },
      hire: {
        description:
          "Hire a teammate onto this workspace. Prefer marketplaceId from search. Or pass name (and optional title, instructions). Needs approval. They appear on the sidebar — do not expect their office to open in this thread.",
        inputSchema: {
          type: "object",
          properties: {
            marketplaceId: { type: "string", minLength: 1, maxLength: 80 },
            name: { type: "string", minLength: 1, maxLength: 80 },
            title: { type: "string", maxLength: 160 },
            description: { type: "string", maxLength: 4000 },
            instructions: { type: "string", maxLength: 20000 },
          },
        },
        requiresApproval: true,
        execute: async (args) =>
          this.host().hireTeammate({
            marketplaceId: optionalString(args, "marketplaceId"),
            name: optionalString(args, "name"),
            title: optionalString(args, "title"),
            description: optionalString(args, "description"),
            instructions: optionalString(args, "instructions"),
          }),
      },
    };
  }
}

function optionalString(
  args: unknown,
  key: string,
  positional = false,
): string | undefined {
  const value = connectorString(args, key, positional);
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numberArg(args: unknown, key: string): number | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
