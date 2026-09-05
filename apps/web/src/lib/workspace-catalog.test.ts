import type { Bot } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { draftCreatedBot } from "./hire";
import {
  botsCollection,
  replaceSyncedRows,
  roomsCollection,
} from "./collections";
import { orpc, queryClient } from "./orpc";
import {
  resetRpcWorkspace,
  setLiveCatalogId,
  setRpcWorkspaceId,
} from "./rpc-workspace";
import { tenantBoundQueryFn } from "./tenant-query";
import {
  adoptWorkspaceCatalog,
  botsListKey,
  knowledgeListKey,
  peekWorkspaceCatalog,
  prepareWorkspaceSwitch,
  snapshotWorkspaceCatalog,
  workspaceCatalogKey,
  workspaceSwitchDestination,
} from "./workspace-catalog";
import { writeCachedWorkspace } from "./workspace-switcher";

function bot(workspaceId: string, id: string): Bot {
  return draftCreatedBot({
    id,
    workspaceId,
    name: id,
    avatarColor: "#e45c9a",
    homeRoomId: `home-${id}`,
  });
}

afterEach(() => {
  resetRpcWorkspace();
  replaceSyncedRows(botsCollection, []);
  replaceSyncedRows(roomsCollection, []);
  queryClient.removeQueries({ queryKey: ["workspace-catalog"] });
  queryClient.removeQueries({ queryKey: botsListKey });
  queryClient.removeQueries({ queryKey: knowledgeListKey });
  queryClient.removeQueries({ queryKey: orpc.me.key() });
  try {
    localStorage.removeItem("groxbot.workspace");
    localStorage.removeItem("groxbot.lastRooms");
  } catch {
    // Node without localStorage.
  }
});

describe("adoptWorkspaceCatalog", () => {
  it("keeps the live roster on first paint of the same office", () => {
    const acme = [bot("ws-1", "ada")];
    queryClient.setQueryData(botsListKey, acme);
    writeCachedWorkspace({ id: "ws-1", name: "Acme", slug: "acme" });
    adoptWorkspaceCatalog("ws-1");
    expect(queryClient.getQueryData(botsListKey)).toEqual(acme);
    expect(peekWorkspaceCatalog("ws-1")?.bots).toEqual(acme);
  });

  it("swaps to a cached office without waiting on the network", () => {
    const acme = [bot("ws-1", "ada")];
    const studio = [bot("ws-2", "sam")];
    queryClient.setQueryData(botsListKey, acme);
    setLiveCatalogId("ws-1");
    snapshotWorkspaceCatalog("ws-1");
    queryClient.setQueryData(workspaceCatalogKey("ws-2"), {
      bots: studio,
      rooms: [],
      sections: [],
      apps: [],
      plugins: [],
      mcp: [],
      knowledge: { entries: [], truncated: false },
    });
    adoptWorkspaceCatalog("ws-2");
    expect(queryClient.getQueryData(botsListKey)).toEqual(studio);
    expect(peekWorkspaceCatalog("ws-1")?.bots).toEqual(acme);
  });

  it("does not show the previous office when the next catalog is cold", () => {
    const acme = [bot("ws-1", "ada")];
    queryClient.setQueryData(botsListKey, acme);
    setLiveCatalogId("ws-1");
    adoptWorkspaceCatalog("ws-2");
    expect(queryClient.getQueryData(botsListKey)).toEqual([]);
    expect(peekWorkspaceCatalog("ws-1")?.bots).toEqual(acme);
  });
});

describe("prepareWorkspaceSwitch", () => {
  it("paints the remembered teammate immediately", () => {
    const studio = [bot("ws-2", "sam")];
    queryClient.setQueryData(workspaceCatalogKey("ws-2"), {
      bots: studio,
      rooms: [],
      sections: [],
      apps: [],
      plugins: [],
      mcp: [],
      knowledge: null,
    });
    setLiveCatalogId("ws-1");
    queryClient.setQueryData(botsListKey, [bot("ws-1", "ada")]);
    const dest = prepareWorkspaceSwitch({
      id: "ws-2",
      name: "Studio",
      slug: "studio",
    });
    expect(dest).toEqual({ to: "/room/$roomId", roomId: "home-sam" });
    expect(queryClient.getQueryData(botsListKey)).toEqual(studio);
  });
});

describe("workspaceSwitchDestination", () => {
  it("opens onboarding when this office has no teammates yet", () => {
    setRpcWorkspaceId("ws-empty");
    queryClient.setQueryData(botsListKey, []);
    expect(workspaceSwitchDestination("ws-empty")).toEqual({
      to: "/onboarding",
    });
  });
});

describe("tenantBoundQueryFn", () => {
  it("returns cached data when the office changes mid-flight", async () => {
    const ada = [bot("ws-1", "ada")];
    queryClient.setQueryData(botsListKey, ada);
    setRpcWorkspaceId("ws-1");
    const fn = tenantBoundQueryFn(botsListKey, async () => {
      setRpcWorkspaceId("ws-2");
      return [bot("ws-2", "sam")];
    });
    await expect(fn()).resolves.toEqual(ada);
  });

  it("returns the fetched list when the office stays put", async () => {
    setRpcWorkspaceId("ws-2");
    const studio = [bot("ws-2", "sam")];
    const fn = tenantBoundQueryFn(botsListKey, async () => studio);
    await expect(fn()).resolves.toEqual(studio);
  });
});
