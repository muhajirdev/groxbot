/** Cloudflare-only. Excluded from `tsc`. */
import {
  McpConnector,
  sanitizeToolName,
  type McpConnectionLike,
} from "@cloudflare/codemode";

export class WorkspaceMcpConnector extends McpConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly connection: McpConnectionLike,
    private readonly serverName: string,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return sanitizeToolName(this.serverName) || "mcp";
  }

  protected override instructions() {
    return (
      this.connection.instructions ||
      `Office MCP server “${this.serverName}”. Search with codemode.search before calling.`
    );
  }

  protected override createConnection() {
    return this.connection;
  }
}
