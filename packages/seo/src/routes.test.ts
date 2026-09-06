import { describe, expect, it } from "vitest";
import { cloudOrigins } from "./identity.js";
import {
  ADF_COMPLETE_PATHS,
  lookupDiscovery,
  mcpGetResponse,
  mcpPostResponse,
} from "./routes.js";

const origins = cloudOrigins();

describe("discovery routes", () => {
  it("publishes the complete AI Discovery File set", () => {
    for (const path of ADF_COMPLETE_PATHS) {
      const doc = lookupDiscovery(path, origins);
      expect(doc, path).toBeDefined();
    }
    expect(lookupDiscovery("/llm.txt", origins)?.redirectTo).toBe("/llms.txt");
    expect(lookupDiscovery("/press.md", origins)?.body).toContain(
      "Groxbot press kit",
    );
    expect(lookupDiscovery("/llms.txt", origins)?.body).toContain("# Groxbot");
  });

  it("serves MCP discovery at /mcp and well-known cards", () => {
    const html = mcpGetResponse("text/html", origins);
    expect(html.contentType).toContain("text/html");
    expect(html.body).toContain("Streamable HTTP");
    const json = mcpGetResponse("application/json", origins);
    expect(json.body).toContain("streamable-http");
    expect(lookupDiscovery("/.well-known/mcp.json", origins)?.body).toContain(
      "https://groxbot.com/mcp",
    );
    expect(lookupDiscovery("/mcp.json", origins)?.body).toContain(
      "io.groxbot/docs",
    );
    expect(lookupDiscovery("/mcp.json", origins)?.body).toContain("/icon.png");
    expect(mcpGetResponse("text/html", origins).body).toContain(
      'property="og:image"',
    );
    expect(mcpGetResponse("text/html", origins).body).toContain("/og.png");
    expect(mcpGetResponse("text/html", origins).body).toContain(
      "summary_large_image",
    );
  });

  it("answers MCP initialize and product-info tools", () => {
    const init = mcpPostResponse(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      origins,
    );
    expect(init.status).toBe(200);
    expect(init.body).toContain("io.groxbot/docs");
    const call = mcpPostResponse(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_product_info" },
      },
      origins,
    );
    expect(call.body).toContain("# Groxbot");
  });
});
