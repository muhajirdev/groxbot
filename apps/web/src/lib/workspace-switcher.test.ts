import { describe, expect, it } from "vitest";
import {
  canSaveWorkspaceName,
  destinationAfterWorkspaceChange,
  parseCachedWorkspace,
  resolveWorkspace,
  workspaceDisplayName,
  workspaceMenuItems,
} from "./workspace-switcher";

describe("workspaceDisplayName", () => {
  it("uses the office name when it is set", () => {
    expect(workspaceDisplayName("Acme")).toBe("Acme");
    expect(workspaceDisplayName("  Acme  ")).toBe("Acme");
  });

  it("falls back when the name is missing", () => {
    expect(workspaceDisplayName(null)).toBe("Workspace");
    expect(workspaceDisplayName("")).toBe("Workspace");
  });
});

describe("parseCachedWorkspace", () => {
  it("reads a stored office", () => {
    expect(
      parseCachedWorkspace(JSON.stringify({ id: "ws-1", name: "Acme" })),
    ).toEqual({ id: "ws-1", name: "Acme" });
  });

  it("ignores junk", () => {
    expect(parseCachedWorkspace(null)).toBeNull();
    expect(parseCachedWorkspace("{")).toBeNull();
    expect(parseCachedWorkspace(JSON.stringify({ id: "ws-1" }))).toBeNull();
    expect(
      parseCachedWorkspace(JSON.stringify({ id: "  ", name: "Acme" })),
    ).toBeNull();
  });
});

describe("resolveWorkspace", () => {
  const cached = { id: "ws-1", name: "Acme" };

  it("uses the live office when it is already loaded", () => {
    expect(
      resolveWorkspace({
        id: "ws-1",
        name: "Acme HQ",
        cached,
      }),
    ).toEqual({ id: "ws-1", name: "Acme HQ" });
  });

  it("keeps the cached name while me is still loading", () => {
    expect(resolveWorkspace({ cached })).toEqual(cached);
  });

  it("does not show a stale name after the office id changes", () => {
    expect(
      resolveWorkspace({
        id: "ws-2",
        name: null,
        cached,
      }),
    ).toEqual({ id: "ws-2", name: undefined });
  });
});

describe("canSaveWorkspaceName", () => {
  it("requires a different non-empty name", () => {
    expect(canSaveWorkspaceName("Acme", "Acme")).toBe(false);
    expect(canSaveWorkspaceName("Acme", "  Acme  ")).toBe(false);
    expect(canSaveWorkspaceName("Acme", "   ")).toBe(false);
    expect(canSaveWorkspaceName("Acme", "Studio")).toBe(true);
  });
});

describe("workspaceMenuItems", () => {
  it("lists the current office and create", () => {
    expect(
      workspaceMenuItems({
        currentId: "ws-1",
        currentName: "Acme",
      }),
    ).toEqual([
      {
        kind: "workspace",
        id: "ws-1",
        name: "Acme",
        slug: "ws-1",
        current: true,
      },
      { kind: "create" },
    ]);
  });

  it("keeps extra offices below the current one", () => {
    expect(
      workspaceMenuItems({
        currentId: "ws-1",
        currentName: "Acme",
        others: [
          { id: "ws-1", name: "Acme", slug: "acme" },
          { id: "ws-2", name: "Studio", slug: "studio" },
        ],
      }),
    ).toEqual([
      {
        kind: "workspace",
        id: "ws-1",
        name: "Acme",
        slug: "ws-1",
        current: true,
      },
      {
        kind: "workspace",
        id: "ws-2",
        name: "Studio",
        slug: "studio",
        current: false,
      },
      { kind: "create" },
    ]);
  });

  it("still offers create when there is no current office", () => {
    expect(workspaceMenuItems({})).toEqual([{ kind: "create" }]);
  });
});

describe("destinationAfterWorkspaceChange", () => {
  it("opens onboarding when the office has no teammates", () => {
    expect(destinationAfterWorkspaceChange([])).toEqual({ to: "/onboarding" });
  });

  it("opens the first live teammate", () => {
    expect(
      destinationAfterWorkspaceChange([
        { id: "bot-archived", archivedAt: "2026-01-01T00:00:00.000Z" },
        { id: "bot-live", archivedAt: null },
      ]),
    ).toEqual({ to: "/bot/$botId", botId: "bot-live" });
  });
});
