import { describe, expect, it } from "vitest";
import { appRpcUrl } from "./app-rpc";
import { appSrcDoc } from "./app-srcdoc";
import { apiOrigin } from "./host";

describe("app iframe document", () => {
  it("injects a Cap'n Web handshake and blocks network", () => {
    const html = appSrcDoc(
      "await gadget.subscribe()",
      "export function newMessagePortRpcSession() {}",
    );
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("handshake");
    expect(html).toContain("newMessagePortRpcSession");
    expect(html).toContain("gadget.subscribe");
    expect(html).not.toContain("gadget:call");
  });

  it("points the live session at the App Durable Object", () => {
    expect(appRpcUrl("app_1")).toBe(
      `${apiOrigin().replace(/^http:/, "ws:")}/apps/app_1/rpc`,
    );
  });
});
