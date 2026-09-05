import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  liveCatalogId,
  resetRpcWorkspace,
  rpcWorkspaceEpoch,
  rpcWorkspaceHeaders,
  rpcWorkspaceId,
  setLiveCatalogId,
  setRpcWorkspaceId,
} from "./rpc-workspace";

afterEach(() => {
  resetRpcWorkspace();
});

describe("rpcWorkspaceHeaders", () => {
  it("omits the tenant header until an office is selected", () => {
    expect(rpcWorkspaceHeaders()).toEqual({});
  });

  it("stamps the explicit workspace on later RPC calls", () => {
    setRpcWorkspaceId("ws_2");
    expect(rpcWorkspaceHeaders()).toEqual({
      [WORKSPACE_ID_HEADER]: "ws_2",
    });
    expect(rpcWorkspaceId()).toBe("ws_2");
  });

  it("bumps the epoch only when the office actually changes", () => {
    const start = rpcWorkspaceEpoch();
    setRpcWorkspaceId("ws_1");
    expect(rpcWorkspaceEpoch()).toBe(start + 1);
    setRpcWorkspaceId("ws_1");
    expect(rpcWorkspaceEpoch()).toBe(start + 1);
    setRpcWorkspaceId("ws_2");
    expect(rpcWorkspaceEpoch()).toBe(start + 2);
  });

  it("tracks which catalog slice is live", () => {
    expect(liveCatalogId()).toBeNull();
    setLiveCatalogId("ws_1");
    expect(liveCatalogId()).toBe("ws_1");
    resetRpcWorkspace();
    expect(liveCatalogId()).toBeNull();
    expect(rpcWorkspaceId()).toBeNull();
  });
});
