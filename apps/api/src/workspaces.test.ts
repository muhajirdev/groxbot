import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@groxbot/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@groxbot/core")>();
  return {
    ...actual,
    ensureWorkspaceBilling: vi.fn(async () => ({
      plan: "free",
      status: "none",
      monthlyTokenLimit: 1_000_000,
    })),
    isWorkspaceOwner: vi.fn(async () => true),
  };
});

vi.mock("./session.js", () => ({
  requireActor: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("./admin-purge.js", () => ({
  deleteAdminWorkspace: vi.fn(async () => ({
    deletedUsers: 0,
    deletedWorkspaces: 1,
    deletedR2Objects: 0,
    deletedAvatars: 0,
    destroyedRoomActors: 0,
    destroyedAppRuntimes: 0,
  })),
}));

import { isWorkspaceOwner } from "@groxbot/core";
import { deleteAdminWorkspace } from "./admin-purge.js";
import { requireActor } from "./session.js";
import {
  activateWorkspace,
  createWorkspace,
  deleteCurrentWorkspace,
  listWorkspaces,
} from "./workspaces.js";

function user(headers = new Headers()) {
  return {
    userId: "u1",
    email: "a@b.co",
    name: "A",
    image: null,
    workspaceId: "ws_1",
    workspaceName: "Acme",
    headers,
    isDeploymentOwner: false,
  };
}

describe("createWorkspace", () => {
  it("creates the office and makes it active", async () => {
    const api = {
      createOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
    };
    const result = await createWorkspace({ auth: { api } } as never, user(), {
      name: "Studio",
    });
    expect(result).toEqual({
      id: "ws_2",
      name: "Studio",
      slug: "studio-u1",
    });
    expect(api.setActiveOrganization).toHaveBeenCalledWith({
      body: { organizationId: "ws_2" },
      headers: expect.any(Headers),
    });
  });

  it("stashes a client id so the office can open before the insert returns", async () => {
    const api = {
      createOrganization: vi.fn(async () => ({
        id: "ws_client",
        name: "Studio",
        slug: "studio-u1",
      })),
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_client",
        name: "Studio",
        slug: "studio-u1",
      })),
    };
    await createWorkspace({ auth: { api } } as never, user(), {
      name: "Studio",
      id: "ws_client",
    });
    expect(api.createOrganization).toHaveBeenCalledWith({
      body: {
        name: "Studio",
        slug: "studio-u1",
        metadata: { groxbotClientId: "ws_client" },
      },
      headers: expect.any(Headers),
    });
  });

  it("writes org.md and optional goal.md into the knowledge library", async () => {
    const api = {
      createOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Northwind Labs",
        slug: "northwind-labs-u1",
      })),
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Northwind Labs",
        slug: "northwind-labs-u1",
      })),
    };
    const write = vi.fn(async () => ({ path: "org.md" }));
    await createWorkspace(
      { auth: { api }, knowledge: { write } } as never,
      user(),
      {
        name: "Northwind Labs",
        team: "Founders and a few engineers",
        goal: "Ship a weekly product for sales.",
      },
    );
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenNthCalledWith(
      1,
      "ws_2",
      expect.objectContaining({
        path: "org.md",
        content: expect.stringContaining("Northwind Labs"),
      }),
    );
    expect(write).toHaveBeenNthCalledWith(
      2,
      "ws_2",
      expect.objectContaining({
        path: "goal.md",
        content: expect.stringContaining("Ship a weekly product for sales."),
      }),
    );
  });

  it("does not write goal.md when they skip the hint", async () => {
    const api = {
      createOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
    };
    const write = vi.fn(async () => ({ path: "org.md" }));
    await createWorkspace(
      { auth: { api }, knowledge: { write } } as never,
      user(),
      { name: "Studio" },
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toMatchObject({ path: "org.md" });
  });
});

describe("listWorkspaces", () => {
  it("returns every office the user belongs to", async () => {
    const api = {
      listOrganizations: vi.fn(async () => [
        { id: "ws_1", name: "Acme", slug: "acme-u1" },
        { id: "ws_2", name: "Studio", slug: "studio-u1" },
      ]),
    };
    await expect(
      listWorkspaces({ auth: { api } } as never, user()),
    ).resolves.toEqual([
      { id: "ws_1", name: "Acme", slug: "acme-u1" },
      { id: "ws_2", name: "Studio", slug: "studio-u1" },
    ]);
  });
});

describe("activateWorkspace", () => {
  it("sets the chosen office active", async () => {
    const api = {
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
    };
    await expect(
      activateWorkspace({ auth: { api } } as never, user(), "ws_2"),
    ).resolves.toEqual({
      id: "ws_2",
      name: "Studio",
      slug: "studio-u1",
    });
    expect(api.setActiveOrganization).toHaveBeenCalledWith({
      body: { organizationId: "ws_2" },
      headers: expect.any(Headers),
    });
  });

  it("rejects a missing office", async () => {
    const api = {
      setActiveOrganization: vi.fn(async () => null),
    };
    await expect(
      activateWorkspace({ auth: { api } } as never, user(), "ws_missing"),
    ).rejects.toBeInstanceOf(ORPCError);
  });
});

describe("deleteCurrentWorkspace", () => {
  beforeEach(() => {
    vi.mocked(deleteAdminWorkspace).mockClear();
    vi.mocked(isWorkspaceOwner).mockReset();
    vi.mocked(isWorkspaceOwner).mockResolvedValue(true);
  });

  function actor() {
    return {
      userId: "u1",
      email: "a@b.co",
      name: "A",
      image: null,
      workspaceId: "ws_1",
      isDeploymentOwner: false,
    };
  }

  function db() {
    return {
      update: () => ({
        set: () => ({
          where: async () => [],
        }),
      }),
    };
  }

  it("deletes the office and activates another", async () => {
    vi.mocked(requireActor).mockResolvedValue(actor());
    vi.mocked(isWorkspaceOwner).mockResolvedValue(true);
    const api = {
      listOrganizations: vi.fn(async () => [
        { id: "ws_1", name: "Acme", slug: "acme-u1" },
        { id: "ws_2", name: "Studio", slug: "studio-u1" },
      ]),
      setActiveOrganization: vi.fn(async () => ({
        id: "ws_2",
        name: "Studio",
        slug: "studio-u1",
      })),
    };
    await expect(
      deleteCurrentWorkspace({
        auth: { api },
        db: db(),
        headers: new Headers(),
      } as never),
    ).resolves.toEqual({
      ok: true,
      next: { id: "ws_2", name: "Studio", slug: "studio-u1" },
    });
    expect(deleteAdminWorkspace).toHaveBeenCalledWith(
      expect.anything(),
      "ws_1",
    );
    expect(api.setActiveOrganization).toHaveBeenCalledWith({
      body: { organizationId: "ws_2" },
      headers: expect.any(Headers),
    });
  });

  it("rejects a member who is not the owner", async () => {
    vi.mocked(requireActor).mockResolvedValue(actor());
    vi.mocked(isWorkspaceOwner).mockResolvedValue(false);
    await expect(
      deleteCurrentWorkspace({
        auth: { api: { listOrganizations: vi.fn() } },
        db: db(),
        headers: new Headers(),
      } as never),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the owner can delete this workspace.",
    });
    expect(deleteAdminWorkspace).not.toHaveBeenCalled();
  });

  it("returns no next office when this was the last one", async () => {
    vi.mocked(requireActor).mockResolvedValue(actor());
    const api = {
      listOrganizations: vi.fn(async () => [
        { id: "ws_1", name: "Acme", slug: "acme-u1" },
      ]),
      setActiveOrganization: vi.fn(),
    };
    await expect(
      deleteCurrentWorkspace({
        auth: { api },
        db: db(),
        headers: new Headers(),
      } as never),
    ).resolves.toEqual({ ok: true, next: null });
    expect(api.setActiveOrganization).not.toHaveBeenCalled();
  });
});
