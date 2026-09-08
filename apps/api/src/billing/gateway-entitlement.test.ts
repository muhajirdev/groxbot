import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGatewayEntitlement } from "./gateway-entitlement.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchGatewayEntitlement", () => {
  it("returns null when the gateway is not configured", async () => {
    expect(
      await fetchGatewayEntitlement(
        { groxGatewayUrl: "", groxGatewaySecret: "" },
        "ws_1",
      ),
    ).toBeNull();
  });

  it("reads usage percent from grox-gateway", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            hostedAllowed: true,
            usagePercent: 25,
            plan: "subscribed",
            status: "active",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchGatewayEntitlement(
      {
        groxGatewayUrl: "https://gateway.groxbot.com",
        groxGatewaySecret: "gw",
      },
      "ws_1",
    );
    expect(result).toEqual({ usagePercent: 25, hostedAllowed: true });
    expect(String(fetchMock.mock.calls.at(0)?.at(0))).toBe(
      "https://gateway.groxbot.com/v1/entitlement",
    );
    const headers = new Headers(
      (fetchMock.mock.calls.at(0)?.at(1) as RequestInit | undefined)?.headers,
    );
    expect(headers.get("authorization")).toBe("Bearer gw");
    expect(headers.get("x-grox-workspace-id")).toBe("ws_1");
  });

  it("returns null when the gateway is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    expect(
      await fetchGatewayEntitlement(
        {
          groxGatewayUrl: "https://gateway.groxbot.com",
          groxGatewaySecret: "gw",
        },
        "ws_1",
      ),
    ).toBeNull();
  });
});
