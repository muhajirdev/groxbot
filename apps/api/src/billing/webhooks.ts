import { applyPolarCustomerState } from "@groxbot/core";
import type { Database } from "@groxbot/db";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate.js";
import type { Env } from "../env.js";
import { syncGatewayEntitlement } from "./gateway-entitlement.js";
import { createPolarClient } from "./polar.js";

function headersRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function workspaceIdFromState(state: CustomerState): string | null {
  const externalId = state.externalId?.trim();
  return externalId || null;
}

function workspaceIdFromWebhookEvent(event: {
  type: string;
  data: unknown;
}): string | null {
  const data = event.data;
  if (!data || typeof data !== "object") return null;

  if ("externalId" in data) {
    const externalId = (data as CustomerState).externalId;
    if (typeof externalId === "string" && externalId.trim()) {
      return externalId.trim();
    }
  }

  if ("customer" in data) {
    const customer = (data as { customer?: { externalId?: string | null } })
      .customer;
    const externalId = customer?.externalId?.trim();
    if (externalId) return externalId;
  }

  return null;
}

function toSnapshot(state: CustomerState) {
  return {
    id: state.id,
    externalId: state.externalId,
    activeSubscriptions: state.activeSubscriptions.map((sub) => ({
      status: sub.status,
      productId: sub.productId,
      currentPeriodEnd: sub.currentPeriodEnd,
    })),
  };
}

const GATEWAY_REFRESH_EVENTS = new Set([
  "subscription.active",
  "subscription.updated",
  "subscription.canceled",
  "benefit_grant.created",
  "benefit_grant.cycled",
]);

async function refreshWorkspaceFromPolar(
  db: Database,
  env: Env,
  workspaceId: string,
): Promise<void> {
  const polar = createPolarClient(env);
  try {
    const state = await polar.customers.getStateExternal({
      externalId: workspaceId,
    });
    await applyPolarCustomerState(db, workspaceId, toSnapshot(state));
    await syncGatewayEntitlement(env, workspaceId, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
      await syncGatewayEntitlement(env, workspaceId);
      return;
    }
    throw error;
  }
}

export async function handlePolarWebhook(
  db: Database,
  env: Env,
  body: string | Buffer,
  headers: Headers,
): Promise<void> {
  const secret = env.polarWebhookSecret?.trim();
  if (!secret) {
    throw new WebhookVerificationError("POLAR_WEBHOOK_SECRET is not set.");
  }
  const event = validateEvent(body, headersRecord(headers), secret);

  if (event.type === "customer.state_changed") {
    const workspaceId = workspaceIdFromState(event.data);
    if (!workspaceId) return;
    await applyPolarCustomerState(db, workspaceId, toSnapshot(event.data));
    await syncGatewayEntitlement(env, workspaceId, event.data);
    return;
  }

  if (!GATEWAY_REFRESH_EVENTS.has(event.type)) return;

  const workspaceId = workspaceIdFromWebhookEvent(event);
  if (!workspaceId) return;

  await refreshWorkspaceFromPolar(db, env, workspaceId);
}
