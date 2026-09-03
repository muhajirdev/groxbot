import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import { requireActor, requireUser } from "./session.js";

function authApi(session: {
  user: { id: string; email: string; name: string };
  session: { activeOrganizationId?: string | null };
}) {
  return {
    getSession: vi.fn(async () => session),
    listOrganizations: vi.fn(async () => [
      { id: "ws_1", name: "Office" },
    ]),
    setActiveOrganization: vi.fn(async () => undefined),
  };
}

describe("requireUser", () => {
  it("skips org listing when the session already has a workspace", async () => {
    const api = authApi({
      user: { id: "u1", email: "a@b.co", name: "A" },
      session: { activeOrganizationId: "ws_1" },
    });
    const user = await requireUser({
      auth: { api },
      headers: new Headers(),
    } as never);
    expect(user.workspaceId).toBe("ws_1");
    expect(api.listOrganizations).not.toHaveBeenCalled();
    expect(api.setActiveOrganization).not.toHaveBeenCalled();
    expect(user.isDeploymentOwner).toBe(false);
    expect(user.image).toBeNull();
  });

  it("lists orgs only when the session has no active workspace", async () => {
    const api = authApi({
      user: { id: "u1", email: "a@b.co", name: "A" },
      session: { activeOrganizationId: null },
    });
    const user = await requireUser({
      auth: { api },
      headers: new Headers(),
    } as never);
    expect(user.workspaceId).toBe("ws_1");
    expect(user.workspaceName).toBe("Office");
    expect(api.listOrganizations).toHaveBeenCalledOnce();
    expect(api.setActiveOrganization).toHaveBeenCalledOnce();
  });

  it("rejects a missing session", async () => {
    const api = {
      getSession: vi.fn(async () => null),
      listOrganizations: vi.fn(),
      setActiveOrganization: vi.fn(),
    };
    await expect(
      requireUser({
        auth: { api },
        headers: new Headers(),
      } as never),
    ).rejects.toBeInstanceOf(ORPCError);
    expect(api.listOrganizations).not.toHaveBeenCalled();
  });
});

describe("requireActor", () => {
  it("does not query orgs when the session already has a workspace", async () => {
    const api = authApi({
      user: { id: "u1", email: "a@b.co", name: "A" },
      session: { activeOrganizationId: "ws_1" },
    });
    const actor = await requireActor({
      auth: { api },
      headers: new Headers(),
    } as never);
    expect(actor.workspaceId).toBe("ws_1");
    expect(api.listOrganizations).not.toHaveBeenCalled();
  });
});
