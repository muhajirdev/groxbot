import { describe, expect, it } from "vitest";
import {
  catalogWithInstalledPlaceholders,
  groupPluginAccounts,
  groupVisiblePlugins,
  matchesMcpQuery,
  matchesPluginAccountQuery,
  mcpHostLabel,
  mcpNeedsReconnect,
  mcpProbeSummary,
  pluginAccountCountByToolkit,
  pluginAccountCountLabel,
  pluginAccountDetail,
  pluginAuthBusyLabel,
  pluginAuthOpeningCopy,
  pluginGridColumns,
  pluginListRows,
  pluginScopeLabel,
  showsCustomMcpSearchCard,
  showsMcpAddForm,
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
  it("keeps the catalog on Browse and only installed ids on Installed", () => {
    const catalog = [gmail, github, canvas];
    expect(
      visiblePluginCards(catalog, "", "browse", new Set(["gmail"])).map(
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
      visiblePluginCards(catalog, "hub", "browse", new Set()).map(
        (item) => item.id,
      ),
    ).toEqual(["github"]);
  });
});

describe("groupVisiblePlugins", () => {
  it("groups Browse by category", () => {
    const groups = groupVisiblePlugins("browse", [gmail, github]);
    expect([...groups.keys()]).toEqual(["Email", "Developer Tools"]);
  });

  it("groups Installed without an empty placeholder section", () => {
    expect([...groupVisiblePlugins("installed", []).keys()]).toEqual([]);
    const groups = groupVisiblePlugins("installed", [gmail, canvas]);
    expect([...groups.keys()]).toEqual(["Installed"]);
  });
});

describe("catalogWithInstalledPlaceholders", () => {
  it("fills in connected toolkits before the GitHub catalog arrives", () => {
    const next = catalogWithInstalledPlaceholders([], new Set(["gmail"]));
    expect(next.map((item) => item.id)).toEqual(["gmail"]);
    expect(next[0]?.name).toBe("Gmail");
  });

  it("does not duplicate a toolkit that is already in the catalog", () => {
    const next = catalogWithInstalledPlaceholders([gmail], new Set(["gmail"]));
    expect(next).toEqual([gmail]);
  });
});

describe("pluginListRows", () => {
  it("chunks a category into grid rows", () => {
    const groups = groupVisiblePlugins("browse", [gmail, github, canvas]);
    const rows = pluginListRows(groups, 2);
    expect(
      rows.filter((row) => row.type === "label").map((row) => row.category),
    ).toEqual(["Email", "Developer Tools", "Canvas"]);
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

describe("plugin auth copy", () => {
  it("names the app while the sign-in window is opening", () => {
    expect(pluginAuthOpeningCopy("Gmail")).toBe("Opening Gmail to sign in…");
    expect(pluginAuthOpeningCopy("")).toBe("Opening this plugin to sign in…");
    expect(pluginAuthBusyLabel()).toBe("Opening…");
  });
});

describe("plugin accounts", () => {
  it("counts several Gmail rows as separate accounts", () => {
    const counts = pluginAccountCountByToolkit([
      { toolkit: "gmail" },
      { toolkit: "gmail" },
      { toolkit: "github" },
    ]);
    expect(counts.get("gmail")).toBe(2);
    expect(pluginAccountCountLabel(0)).toBe("");
    expect(pluginAccountCountLabel(1)).toBe("1 account");
    expect(pluginAccountCountLabel(2)).toBe("2 accounts");
  });

  it("labels shared vs private the same way MCP cards do", () => {
    expect(pluginScopeLabel("shared")).toBe("Shared");
    expect(pluginScopeLabel("private")).toBe("Private");
    expect(
      pluginAccountDetail({
        visibility: "private",
        status: "connected",
        lastError: null,
      }),
    ).toBe("Private");
    expect(
      pluginAccountDetail({
        visibility: "shared",
        status: "added",
        lastError: null,
      }),
    ).toBe("Shared · Not authenticated");
    expect(
      pluginAccountDetail({
        visibility: "shared",
        status: "error",
        lastError: "expired",
      }),
    ).toBe("expired");
  });

  it("groups installed accounts by catalog name", () => {
    const groups = groupPluginAccounts(
      [
        {
          id: "a",
          toolkit: "gmail",
          status: "connected",
          visibility: "shared",
          userId: "u1",
          connectedAccountId: "ca_1",
          lastError: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "b",
          toolkit: "gmail",
          status: "added",
          visibility: "private",
          userId: "u1",
          connectedAccountId: null,
          lastError: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      (toolkit) => (toolkit === "gmail" ? "Gmail" : toolkit),
    );
    expect([...groups.keys()]).toEqual(["Gmail"]);
    expect(groups.get("Gmail")?.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("matches plugin search against catalog name or toolkit slug", () => {
    expect(
      matchesPluginAccountQuery({ toolkit: "gmail" }, "Gmail", "mail"),
    ).toBe(true);
    expect(
      matchesPluginAccountQuery({ toolkit: "github" }, "GitHub", "mail"),
    ).toBe(false);
  });
});

describe("custom MCP add path", () => {
  it("keeps a Custom MCP card at the top of Search", () => {
    expect(showsCustomMcpSearchCard("")).toBe(false);
    expect(showsCustomMcpSearchCard("mcp")).toBe(true);
    expect(showsCustomMcpSearchCard("Custom")).toBe(true);
    expect(showsCustomMcpSearchCard("gmail")).toBe(false);
  });

  it("shows the add form when Installed has no servers yet", () => {
    expect(showsMcpAddForm("", false, 0)).toBe(true);
    expect(showsMcpAddForm("", false, 1)).toBe(false);
    expect(showsMcpAddForm("", true, 1)).toBe(true);
    expect(showsMcpAddForm("linear", true, 0)).toBe(false);
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
          error:
            "Catalog says connected, but the live client is not answering.",
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
