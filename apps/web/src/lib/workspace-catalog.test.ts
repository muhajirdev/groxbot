import type { Bot } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { draftCreatedBot } from "./hire";
import {
  botsCollection,
  replaceSyncedRows,
  roomsCollection,
} from "./collections";
import { orpc, queryClient } from "./orpc";
import { workspaceListQueryOptions } from "./office-persist";
import {
  resetRpcWorkspace,
  setLiveCatalogId,
  setRpcWorkspaceId,
} from "./rpc-workspace";
import { tenantBoundQueryFn } from "./tenant-query";
import {
  adoptWorkspaceCatalog,
  botsListKey,
  commitCreatedWorkspace,
  forgetListedWorkspace,
  patchMeWorkspace,
  knowledgeListKey,
  peekWorkspaceCatalog,
  prepareWorkspaceSwitch,
  rememberListedWorkspace,
  snapshotWorkspaceCatalog,
  trackPendingWorkspaceCreate,
  whenWorkspaceReady,
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
  queryClient.removeQueries({
    queryKey: workspaceListQueryOptions().queryKey,
  });
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

  it("opens a new office without waiting on catalogs", () => {
    setLiveCatalogId("ws-1");
    queryClient.setQueryData(botsListKey, [bot("ws-1", "ada")]);
    const dest = prepareWorkspaceSwitch(
      { id: "ws-new", name: "Studio", slug: "studio-u1" },
      { refetch: false },
    );
    expect(dest).toEqual({ to: "workspace" });
    expect(queryClient.getQueryData(botsListKey)).toEqual([]);
  });
});

describe("workspaceSwitchDestination", () => {
  it("opens the workspace when this office has no teammates yet", () => {
    setRpcWorkspaceId("ws-empty");
    queryClient.setQueryData(botsListKey, []);
    expect(workspaceSwitchDestination("ws-empty")).toEqual({
      to: "workspace",
    });
  });
});

describe("rememberListedWorkspace", () => {
  it("inserts a just-created office into an empty list", () => {
    queryClient.setQueryData(workspaceListQueryOptions().queryKey, []);
    rememberListedWorkspace({
      id: "ws-m",
      name: "Muhajir",
      slug: "muhajir-5v6j44mv",
    });
    expect(
      queryClient.getQueryData(workspaceListQueryOptions().queryKey),
    ).toEqual([
      { id: "ws-m", name: "Muhajir", slug: "muhajir-5v6j44mv" },
    ]);
  });

  it("updates the name of an office already in the list", () => {
    queryClient.setQueryData(workspaceListQueryOptions().queryKey, [
      { id: "ws-m", name: "Old", slug: "muhajir-5v6j44mv" },
    ]);
    rememberListedWorkspace({
      id: "ws-m",
      name: "Muhajir",
      slug: "muhajir-5v6j44mv",
    });
    expect(
      queryClient.getQueryData(workspaceListQueryOptions().queryKey),
    ).toEqual([
      { id: "ws-m", name: "Muhajir", slug: "muhajir-5v6j44mv" },
    ]);
  });

  it("drops a draft office when create fails", () => {
    queryClient.setQueryData(workspaceListQueryOptions().queryKey, [
      { id: "ws-1", name: "Acme", slug: "acme" },
      { id: "ws-draft", name: "Studio", slug: "studio-u1" },
    ]);
    forgetListedWorkspace("ws-draft");
    expect(
      queryClient.getQueryData(workspaceListQueryOptions().queryKey),
    ).toEqual([{ id: "ws-1", name: "Acme", slug: "acme" }]);
  });
});

describe("patchMeWorkspace", () => {
  const me = {
    userId: "u1",
    email: "a@b.co",
    name: "A",
    image: null,
    isDeploymentOwner: false,
    needsModel: false,
    needsHostedPlan: true,
    defaultModel: "x",
    defaultModelLabel: "X",
    modelWarning: null,
  };

  it("offers a trial on a new office instead of inheriting trial-ended copy", () => {
    queryClient.setQueryData(orpc.me.key(), {
      ...me,
      workspaceId: "ws-old",
      workspaceName: "Old",
      workspaceSlug: "old",
      needsWorkspace: false,
      trialAvailable: false,
    });
    patchMeWorkspace({ id: "ws-new", name: "New", slug: "new" });
    expect(queryClient.getQueryData(orpc.me.key())).toMatchObject({
      workspaceId: "ws-new",
      trialAvailable: true,
    });
  });

  it("keeps trial-ended copy when the same office is renamed", () => {
    queryClient.setQueryData(orpc.me.key(), {
      ...me,
      workspaceId: "ws-1",
      workspaceName: "Acme",
      workspaceSlug: "acme",
      needsWorkspace: false,
      trialAvailable: false,
    });
    patchMeWorkspace({ id: "ws-1", name: "Acme Co", slug: "acme" });
    expect(queryClient.getQueryData(orpc.me.key())).toMatchObject({
      workspaceName: "Acme Co",
      trialAvailable: false,
    });
  });
});

describe("commitCreatedWorkspace", () => {
  it("remaps a draft id onto the server row", () => {
    queryClient.setQueryData(workspaceListQueryOptions().queryKey, [
      { id: "ws-draft", name: "Studio", slug: "studio-u1" },
    ]);
    queryClient.setQueryData(orpc.me.key(), {
      userId: "u1",
      email: "a@b.co",
      name: "A",
      image: null,
      workspaceId: "ws-draft",
      workspaceName: "Studio",
      workspaceSlug: "studio-u1",
      needsWorkspace: false,
      isDeploymentOwner: false,
      needsModel: false,
      needsHostedPlan: false,
      trialAvailable: true,
      defaultModel: "x",
      defaultModelLabel: "X",
      modelWarning: null,
    });
    commitCreatedWorkspace(
      { id: "ws-draft", name: "Studio", slug: "studio-u1" },
      { id: "ws-real", name: "Studio", slug: "studio-u1" },
    );
    expect(
      queryClient.getQueryData(workspaceListQueryOptions().queryKey),
    ).toEqual([{ id: "ws-real", name: "Studio", slug: "studio-u1" }]);
    expect(queryClient.getQueryData(orpc.me.key())).toMatchObject({
      workspaceId: "ws-real",
      workspaceSlug: "studio-u1",
    });
  });
});

describe("whenWorkspaceReady", () => {
  it("resolves immediately when nothing is in flight", async () => {
    await expect(whenWorkspaceReady("ws-1")).resolves.toBeUndefined();
  });

  it("waits for the in-flight create", async () => {
    let release: (value: unknown) => void = () => undefined;
    const work = new Promise((resolve) => {
      release = resolve;
    });
    trackPendingWorkspaceCreate("ws-draft", work);
    let ready = false;
    const wait = whenWorkspaceReady("ws-draft").then(() => {
      ready = true;
    });
    expect(ready).toBe(false);
    release(null);
    await wait;
    expect(ready).toBe(true);
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
