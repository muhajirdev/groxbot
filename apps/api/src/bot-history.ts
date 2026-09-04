/** Cloudflare-only. Excluded from `tsc`. This office thread as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import {
  connectorString,
  OfficeHistoryError,
  type OfficeHistorySearch,
} from "@groxbot/core";

export type HistoryHost = {
  officeHistorySearch(
    query: string,
    limit?: number,
  ): Promise<OfficeHistorySearch>;
};

export class HistoryConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly host: () => HistoryHost,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "history";
  }

  protected override instructions() {
    return [
      "This office thread — the current branch on this desk, not other teammates, not the knowledge library.",
      "Search when someone asks what you decided earlier or the live window may have dropped old turns.",
      "Returns ranked snippets. Do not paste the whole thread into memory or a skill.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      search: {
        description:
          "Search this office thread for older user and assistant messages. Skips the live question, hidden office kicks, and tool dumps. truncated means only the newest 800 searchable turns were ranked.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", minLength: 1, maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: 12 },
          },
          required: ["query"],
        },
        replay: "reexecute",
        execute: async (args) => {
          const query = stringArg(args, "query", true);
          const limit = numberArg(args, "limit");
          return this.host().officeHistorySearch(query, limit);
        },
      },
    };
  }
}

function stringArg(args: unknown, key: string, positional = false): string {
  const value = connectorString(args, key, positional);
  if (!value) throw new OfficeHistoryError();
  return value;
}

function numberArg(args: unknown, key: string): number | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return undefined;
  }
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
