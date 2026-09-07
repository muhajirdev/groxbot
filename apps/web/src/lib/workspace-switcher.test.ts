import { describe, expect, it, vi } from "vitest";
import {
  canDeleteWorkspace,
  canSaveWorkspaceName,
  destinationAfterWorkspaceChange,
  draftCreatedWorkspace,
  forgetLastRoom,
  LAST_ROOMS_KEY,
  parseCachedWorkspace,
  parseLastRooms,
  resolveWorkspace,
  resolveWorkspaceForRoute,
  workspaceDisplayName,
  workspaceFromCache,
  workspaceFromList,
  workspaceMenuItems,
  writeLastRoom,
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

describe("draftCreatedWorkspace", () => {
  it("predicts the same slug the server will use", () => {
    expect(
      draftCreatedWorkspace({
        name: "Acme Labs",
        userId: "user-12ab-34cd",
        id: "ws-draft",
      }),
    ).toEqual({
      id: "ws-draft",
      name: "Acme Labs",
      slug: "acme-labs-user12ab",
    });
  });
});

describe("workspaceFromList", () => {
  const offices = [
    { id: "ws-1", name: "Acme", slug: "acme" },
    { id: "ws-2", name: "Studio", slug: "studio" },
  ];

  it("matches slug then id", () => {
    expect(workspaceFromList(offices, "studio")?.id).toBe("ws-2");
    expect(workspaceFromList(offices, "ws-1")?.slug).toBe("acme");
    expect(workspaceFromList(offices, "missing")).toBeUndefined();
  });
});

describe("resolveWorkspaceForRoute", () => {
  const acme = { id: "ws-1", name: "Acme", slug: "acme" };
  const muhajir = {
    id: "ws-m",
    name: "Muhajir",
    slug: "muhajir-5v6j44mv",
  };

  it("uses the listed office without fetching", async () => {
    let fetched = 0;
    await expect(
      resolveWorkspaceForRoute({
        slug: "acme",
        listed: [acme],
        hinted: null,
        fetchList: async () => {
          fetched += 1;
          return [];
        },
      }),
    ).resolves.toEqual({ workspace: acme, needsListRefresh: false });
    expect(fetched).toBe(0);
  });

  it("opens from the last office when workspaces.list is still empty", async () => {
    let fetched = 0;
    await expect(
      resolveWorkspaceForRoute({
        slug: "muhajir-5v6j44mv",
        listed: [],
        hinted: muhajir,
        fetchList: async () => {
          fetched += 1;
          return [];
        },
      }),
    ).resolves.toEqual({ workspace: muhajir, needsListRefresh: true });
    expect(fetched).toBe(0);
  });

  it("refetches when the slug is missing and there is no local hint", async () => {
    await expect(
      resolveWorkspaceForRoute({
        slug: "muhajir-5v6j44mv",
        listed: [],
        hinted: null,
        fetchList: async () => [muhajir],
      }),
    ).resolves.toEqual({ workspace: muhajir, needsListRefresh: false });
  });

  it("does not bounce when a fresh list still lacks the slug", async () => {
    await expect(
      resolveWorkspaceForRoute({
        slug: "muhajir-5v6j44mv",
        listed: [acme],
        hinted: null,
        fetchList: async () => [acme],
      }),
    ).resolves.toBeUndefined();
  });
});

describe("workspaceFromCache", () => {
  it("returns the last office when the URL slug or id matches", () => {
    expect(
      workspaceFromCache({ id: "ws-1", name: "Acme", slug: "acme" }, "acme"),
    ).toEqual({ id: "ws-1", name: "Acme", slug: "acme" });
    expect(
      workspaceFromCache({ id: "ws-1", name: "Acme" }, "ws-1"),
    ).toEqual({ id: "ws-1", name: "Acme", slug: "ws-1" });
  });

  it("ignores a cached office for a different URL", () => {
    expect(
      workspaceFromCache({ id: "ws-1", name: "Acme", slug: "acme" }, "other"),
    ).toBeNull();
    expect(workspaceFromCache(null, "acme")).toBeNull();
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

describe("parseLastRooms", () => {
  it("reads a map of last desks", () => {
    expect(
      parseLastRooms(JSON.stringify({ "ws-1": "home-1", "ws-2": "room-9" })),
    ).toEqual({ "ws-1": "home-1", "ws-2": "room-9" });
  });

  it("ignores junk", () => {
    expect(parseLastRooms(null)).toEqual({});
    expect(parseLastRooms("{")).toEqual({});
    expect(parseLastRooms(JSON.stringify(["home-1"]))).toEqual({});
    expect(parseLastRooms(JSON.stringify({ "ws-1": 1 }))).toEqual({});
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

describe("canDeleteWorkspace", () => {
  it("only the owner of this office can delete it", () => {
    expect(canDeleteWorkspace([{ mine: true, role: "owner" }])).toBe(true);
    expect(
      canDeleteWorkspace([
        { mine: true, role: "member" },
        { mine: false, role: "owner" },
      ]),
    ).toBe(false);
    expect(canDeleteWorkspace([])).toBe(false);
  });
});

describe("forgetLastRoom", () => {
  it("drops the last desk for one office", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    writeLastRoom("ws-1", "home-1");
    writeLastRoom("ws-2", "home-2");
    forgetLastRoom("ws-1");
    expect(parseLastRooms(store[LAST_ROOMS_KEY] ?? null)).toEqual({
      "ws-2": "home-2",
    });
    vi.unstubAllGlobals();
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
  it("opens the workspace when the office has no teammates", () => {
    expect(destinationAfterWorkspaceChange([])).toEqual({ to: "workspace" });
  });

  it("opens the last desk when it is still in this office", () => {
    expect(
      destinationAfterWorkspaceChange(
        [{ id: "bot-live", homeRoomId: "home-live", archivedAt: null }],
        { lastRoomId: "home-live" },
      ),
    ).toEqual({ to: "/room/$roomId", roomId: "home-live" });
    expect(
      destinationAfterWorkspaceChange(
        [{ id: "bot-live", homeRoomId: "home-live", archivedAt: null }],
        { lastRoomId: "room-group", rooms: [{ id: "room-group" }] },
      ),
    ).toEqual({ to: "/room/$roomId", roomId: "room-group" });
  });

  it("uses the remembered room when the catalog has not loaded yet", () => {
    expect(
      destinationAfterWorkspaceChange([], { lastRoomId: "home-live" }),
    ).toEqual({ to: "/room/$roomId", roomId: "home-live" });
  });

  it("ignores a last desk that belongs to a different office", () => {
    expect(
      destinationAfterWorkspaceChange(
        [{ id: "bot-live", homeRoomId: "home-live", archivedAt: null }],
        { lastRoomId: "other-home" },
      ),
    ).toEqual({ to: "/room/$roomId", roomId: "home-live" });
  });
});
