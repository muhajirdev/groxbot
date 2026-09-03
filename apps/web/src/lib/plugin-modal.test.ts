import { describe, expect, it } from "vitest";
import {
  groupVisiblePlugins,
  matchesMcpQuery,
  mcpHostLabel,
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
});
