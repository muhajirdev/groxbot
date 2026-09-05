import { describe, expect, it } from "vitest";
import {
  catalogWithInstalledPlaceholders,
  groupVisiblePlugins,
  matchesMcpQuery,
  mcpHostLabel,
  mcpNeedsReconnect,
  mcpProbeSummary,
  pluginGridColumns,
  pluginListRows,
  visiblePluginCards,
} from "./plugin-modal";
import type { PluginCard } from "./plugins";

const gmail: PluginCard = {
  id: "gmail",
  name: "Gmail",
  blurb: "Mail",
  category: "Email",
  kind: "connector",
};

const github: PluginCard = {
  id: "github",
  name: "GitHub",
  blurb: "PRs",
  category: "Developer Tools",
  kind: "connector",
};

const canvas: PluginCard = {
  id: "docs-canvas",
  name: "Docs Canvas",
  blurb: "Draft",
  category: "Canvas",
  kind: "skill",
};

describe("visiblePluginCards", () => {
  it("keeps the catalog on Search and only installed ids on Installed", () => {
    const catalog = [gmail, github, canvas];
    expect(
      visiblePluginCards(catalog, "", "search", new Set(["gmail"])).map(
        (item) => item.id,
      ),
    ).toEqual(["gmail", "github", "docs-canvas"]);
    expect(
      visiblePluginCards(catalog, "", "installed", new Set(["gmail"])).map(
        (item) => item.id,
      ),
    ).toEqual(["gmail"]);
  });

  it("filters by name or id", () => {
    const catalog = [gmail, github];
    expect(
      visiblePluginCards(catalog, "hub", "search", new Set()).map(
        (item) => item.id,
      ),
    ).toEqual(["github"]);
  });
});

describe("groupVisiblePlugins", () => {
  it("groups Search by category", () => {
    const groups = groupVisiblePlugins("search", [gmail, github]);
    expect([...groups.keys()]).toEqual(["Email", "Developer Tools"]);
  });

  it("groups Installed without an empty placeholder section", () => {
    expect([...groupVisiblePlugins("installed", []).keys()]).toEqual([]);
    const groups = groupVisiblePlugins("installed", [gmail, canvas]);
    expect([...groups.keys()]).toEqual(["Installed", "Skills"]);
  });
});

describe("catalogWithInstalledPlaceholders", () => {
  it("fills in connected toolkits before the GitHub catalog arrives", () => {
    const next = catalogWithInstalledPlaceholders([], new Set(["gmail"]));
    expect(next.map((item) => item.id)).toEqual(["gmail"]);
    expect(next[0]?.name).toBe("Gmail");
  });

  it("does not duplicate a toolkit that is already in the catalog", () => {
    const next = catalogWithInstalledPlaceholders(
      [gmail],
      new Set(["gmail"]),
    );
    expect(next).toEqual([gmail]);
  });
});

describe("pluginListRows", () => {
  it("chunks a category into grid rows", () => {
    const groups = groupVisiblePlugins("search", [gmail, github, canvas]);
    const rows = pluginListRows(groups, 2);
    expect(rows.filter((row) => row.type === "label").map((row) => row.category)).toEqual([
      "Email",
      "Developer Tools",
      "Canvas",
    ]);
    const cards = rows.flatMap((row) => (row.type === "row" ? row.items : []));
    expect(cards.map((item) => item.id)).toEqual([
      "gmail",
      "github",
      "docs-canvas",
    ]);
  });
});

describe("pluginGridColumns", () => {
  it("fits as many 200px cards as the pane allows", () => {
    expect(pluginGridColumns(0)).toBe(1);
    expect(pluginGridColumns(200)).toBe(1);
    expect(pluginGridColumns(410)).toBe(2);
    expect(pluginGridColumns(630)).toBe(3);
  });
});

describe("mcp display", () => {
  it("shows the host for a valid URL", () => {
    expect(mcpHostLabel("https://mimpi.mu/api/mcp")).toBe("mimpi.mu");
  });

  it("falls back when the URL is not parseable", () => {
    expect(mcpHostLabel("not a url")).toBe("not a url");
  });

  it("matches custom MCP search against name or URL", () => {
    expect(matchesMcpQuery("linear", "https://mimpi.mu/api/mcp", "MIMPI")).toBe(
      true,
    );
    expect(matchesMcpQuery("linear", "https://mimpi.mu/api/mcp", "hub")).toBe(
      false,
    );
  });

  it("summarizes a live MCP probe for the Installed card", () => {
    expect(
      mcpProbeSummary(
        { ok: true, tools: ["list_dreams", "get_user"], error: null },
        "mimpi.mu",
      ),
    ).toBe("2 tools · list_dreams, get_user");
    expect(
      mcpProbeSummary({ ok: true, tools: [], error: null }, "mimpi.mu"),
    ).toBe("mimpi.mu · live, no tools yet");
    expect(
      mcpProbeSummary(
        {
          ok: false,
          tools: [],
          error: "Catalog says connected, but the live client is not answering.",
        },
        "mimpi.mu",
      ),
    ).toBe("Catalog says connected, but the live client is not answering.");
  });

  it("reconnects when the catalog is green but the live client is not answering", () => {
    expect(mcpNeedsReconnect({ status: "connected" })).toBe(false);
    expect(mcpNeedsReconnect({ status: "connected" }, { ok: false })).toBe(
      true,
    );
    expect(mcpNeedsReconnect({ status: "connected" }, { ok: true })).toBe(
      false,
    );
  });
});
