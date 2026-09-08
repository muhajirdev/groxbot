import type { Env } from "../env.js";

export type GatewayEntitlement = {
  usagePercent: number;
  hostedAllowed: boolean;
};

function gatewayBase(
  env: Pick<Env, "groxGatewayUrl" | "groxGatewaySecret">,
): { base: string; secret: string } | null {
  const base = env.groxGatewayUrl?.trim().replace(/\/$/, "") ?? "";
  const secret = env.groxGatewaySecret?.trim() ?? "";
  if (!base || !secret) return null;
  return { base, secret };
}

/** Hosted usage percent from grox-gateway (workspace key). Null when unset or fetch fails. */
export async function fetchGatewayEntitlement(
  env: Pick<Env, "groxGatewayUrl" | "groxGatewaySecret">,
  workspaceId: string,
): Promise<GatewayEntitlement | null> {
  const gateway = gatewayBase(env);
  if (!gateway) return null;
  try {
    const response = await fetch(`${gateway.base}/v1/entitlement`, {
      headers: {
        authorization: `Bearer ${gateway.secret}`,
        "x-grox-workspace-id": workspaceId,
      },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      usagePercent?: unknown;
      hostedAllowed?: unknown;
    };
    const usagePercent = Number(body.usagePercent);
    if (!Number.isFinite(usagePercent)) return null;
    return {
      usagePercent: Math.min(100, Math.max(0, Math.round(usagePercent))),
      hostedAllowed: body.hostedAllowed === true,
    };
  } catch (error) {
    console.error("gateway entitlement fetch error", workspaceId, error);
    return null;
  }
}

/** Push Polar customer state (or refresh) to grox-gateway KV. */
export async function syncGatewayEntitlement(
  env: Pick<Env, "groxGatewayUrl" | "groxGatewaySecret">,
  workspaceId: string,
  customerState?: unknown,
): Promise<void> {
  const base = env.groxGatewayUrl?.trim().replace(/\/$/, "");
  const secret = env.groxGatewaySecret?.trim();
  if (!base || !secret) return;

  try {
    const response = await fetch(`${base}/internal/entitlement`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        "x-grox-workspace-id": workspaceId,
      },
      body: customerState ? JSON.stringify(customerState) : "{}",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "gateway entitlement sync failed",
        workspaceId,
        response.status,
        detail.slice(0, 200),
      );
    }
  } catch (error) {
    console.error("gateway entitlement sync error", workspaceId, error);
  }
}
