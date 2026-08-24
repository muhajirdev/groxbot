import type {
  GuestAgentKind,
  GuestConnect,
  GuestStatus,
} from "@groxbot/contracts";
import { GuestKind } from "@groxbot/contracts";
import { guestConnectCommand, mintGuestToken, newId } from "@groxbot/core";
import { bots, guestConnectors } from "@groxbot/db";
import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { getBotThread } from "./bots.js";
import type { RpcContext } from "./context.js";
import type { Actor } from "./session.js";

const STALE_MS = 60_000;

export function guestConnectUrl(env: RpcContext["env"]): string {
  return (
    env.guestUrl ??
    env.workerUrl ??
    env.apiUrl ??
    "http://127.0.0.1:3100"
  ).replace(/\/$/, "");
}

export function connectorOnline(
  row:
    | {
        online: boolean;
        revokedAt: Date | null;
        lastSeenAt: Date | null;
      }
    | undefined,
): boolean {
  if (!row || row.revokedAt || !row.online || !row.lastSeenAt) return false;
  return Date.now() - row.lastSeenAt.getTime() < STALE_MS;
}

function statusFrom(
  botId: string,
  kind: string,
  row: typeof guestConnectors.$inferSelect | undefined,
  connectUrl: string,
): GuestStatus {
  const parsed = GuestKind.safeParse(kind);
  return {
    botId,
    kind: parsed.success ? parsed.data : "off",
    online: connectorOnline(row),
    lastSeenAt: row?.lastSeenAt?.toISOString() ?? null,
    connectUrl,
  };
}

async function loadConnector(context: RpcContext, botId: string) {
  const [row] = await context.db
    .select()
    .from(guestConnectors)
    .where(eq(guestConnectors.botId, botId))
    .limit(1);
  return row;
}

function issueToken(
  connectorId: string,
  kind: GuestAgentKind,
  connectUrl: string,
) {
  const minted = mintGuestToken(connectorId);
  return {
    ...minted,
    command: guestConnectCommand({
      connectUrl,
      token: minted.token,
      kind,
    }),
  };
}

export async function guestStatus(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<GuestStatus> {
  const { bot } = await getBotThread(context, actor, botId);
  const row = await loadConnector(context, botId);
  return statusFrom(bot.id, bot.guestKind, row, guestConnectUrl(context.env));
}

export async function enableGuest(
  context: RpcContext,
  actor: Actor,
  botId: string,
  kind: GuestAgentKind,
): Promise<GuestConnect> {
  const { bot } = await getBotThread(context, actor, botId);
  if (bot.archivedAt) {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "This teammate is archived.",
    });
  }
  const connectUrl = guestConnectUrl(context.env);
  const existing = await loadConnector(context, botId);
  const connectorId = existing?.id ?? newId();
  const issued = issueToken(connectorId, kind, connectUrl);
  const now = new Date();
  const session = context.guests?.getByBot(botId);
  if (session) context.guests?.bye(session.id);
  await context.enqueue({
    botId,
    name: "guest.drop",
    payload: { botId },
  });
  if (existing) {
    await context.db
      .update(guestConnectors)
      .set({
        kind,
        tokenHash: issued.tokenHash,
        userId: actor.userId,
        online: false,
        lastSeenAt: null,
        revokedAt: null,
        updatedAt: now,
      })
      .where(eq(guestConnectors.id, existing.id));
  } else {
    await context.db.insert(guestConnectors).values({
      id: connectorId,
      botId: bot.id,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      kind,
      tokenHash: issued.tokenHash,
      online: false,
      createdAt: now,
      updatedAt: now,
    });
  }
  await context.db
    .update(bots)
    .set({ guestKind: kind, updatedAt: now })
    .where(and(eq(bots.id, bot.id), eq(bots.workspaceId, actor.workspaceId)));
  return {
    ...statusFrom(bot.id, kind, undefined, connectUrl),
    token: issued.token,
    command: issued.command,
  };
}

export async function rotateGuest(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<GuestConnect> {
  const { bot } = await getBotThread(context, actor, botId);
  if (bot.guestKind === "off") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Enable an external agent first",
    });
  }
  const kind = bot.guestKind as GuestAgentKind;
  return enableGuest(context, actor, botId, kind);
}

export async function disableGuest(
  context: RpcContext,
  actor: Actor,
  botId: string,
): Promise<{ ok: true }> {
  const { bot } = await getBotThread(context, actor, botId);
  const session = context.guests?.getByBot(botId);
  if (session) context.guests?.bye(session.id);
  await context.enqueue({
    botId,
    name: "guest.drop",
    payload: { botId },
  });
  await context.db
    .update(guestConnectors)
    .set({
      revokedAt: new Date(),
      online: false,
      lastSeenAt: null,
      tokenHash: "revoked",
      updatedAt: new Date(),
    })
    .where(eq(guestConnectors.botId, botId));
  await context.db
    .update(bots)
    .set({ guestKind: "off", updatedAt: new Date() })
    .where(eq(bots.id, bot.id));
  return { ok: true };
}
