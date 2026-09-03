import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import {
  activateWorkspace,
  createWorkspace,
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
    const result = await createWorkspace(
      { auth: { api } } as never,
      user(),
      "Studio",
    );
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
