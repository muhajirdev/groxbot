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
    const slug = this.name();
    return (
      this.connection.instructions ||
      `Workspace MCP “${this.serverName}”. Call await ${slug}.<method>(args). Use await codemode.describe("${slug}") for methods — search does not list this connector.`
    );
  }

  protected override createConnection() {
    return this.connection;
  }
}
