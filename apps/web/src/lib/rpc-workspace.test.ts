import { WORKSPACE_ID_HEADER } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { rpcWorkspaceHeaders, setRpcWorkspaceId } from "./rpc-workspace";

afterEach(() => {
  setRpcWorkspaceId(null);
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
  });
});
