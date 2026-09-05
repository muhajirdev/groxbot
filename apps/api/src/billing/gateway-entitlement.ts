import type { Env } from "../env.js";

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
