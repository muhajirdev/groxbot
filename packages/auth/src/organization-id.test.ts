import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_CLIENT_ID_KEY,
  organizationCreateFromClientId,
} from "./organization-id";

describe("organizationCreateFromClientId", () => {
  it("promotes the client id and drops the stash key", () => {
    expect(
      organizationCreateFromClientId({
        name: "Studio",
        slug: "studio-u1",
        metadata: { [ORGANIZATION_CLIENT_ID_KEY]: "ws_client" },
      }),
    ).toEqual({
      data: {
        name: "Studio",
        slug: "studio-u1",
        id: "ws_client",
        metadata: undefined,
      },
    });
  });

  it("keeps other metadata", () => {
    expect(
      organizationCreateFromClientId({
        name: "Studio",
        slug: "studio-u1",
        metadata: {
          [ORGANIZATION_CLIENT_ID_KEY]: "ws_client",
          plan: "free",
        },
      })?.data.metadata,
    ).toEqual({ plan: "free" });
  });

  it("does nothing when the client did not send an id", () => {
    expect(
      organizationCreateFromClientId({
        name: "Studio",
        slug: "studio-u1",
      }),
    ).toBeUndefined();
  });
});
