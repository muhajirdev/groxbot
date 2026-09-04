/** Cloudflare-only. Excluded from `tsc`. Cap’n Web host for a board RoomActor. */
import type { OfficeUserMeta } from "@groxbot/contracts";
import {
  OFFICE_WORKSPACE_HEADER,
  parseOfficeChatMessages,
} from "@groxbot/core";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import type { OfficeChatSubscriber } from "./bot-office-rpc.js";
import type { RoomActor } from "./room-actor.js";

export { OFFICE_WORKSPACE_HEADER };

export type RoomChatSubscriber = OfficeChatSubscriber;

export class RoomChatHost extends RpcTarget {
  constructor(
    private readonly actor: RoomActor,
    private readonly user: OfficeUserMeta | null,
  ) {
    super();
  }

  subscribe(subscriber: RoomChatSubscriber): Promise<void> {
    return this.actor.subscribeRoom(subscriber);
  }

  run(messages: unknown, targetBotId?: unknown): Promise<void> {
    const target = readTargetBotId(targetBotId);
    return this.actor.runRoom(parseOfficeChatMessages(messages), this.user, {
      targetBotId: target,
    });
  }

  stop(): Promise<void> {
    return this.actor.stopRoom();
  }
}

function readTargetBotId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const id = (value as { targetBotId?: unknown }).targetBotId;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

export function roomRpcResponse(
  actor: RoomActor,
  request: Request,
  user: OfficeUserMeta | null,
): Response | Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  return newWorkersRpcResponse(request, new RoomChatHost(actor, user));
}

type RoomNamespace = DurableObjectNamespace;

function roomStub(ns: RoomNamespace, roomId: string) {
  return ns.get(ns.idFromName(roomId));
}

export async function initRoomActor(
  ns: RoomNamespace,
  roomId: string,
  opts: {
    workspaceId: string;
    name: string;
    members: Array<{ id: string; name: string }>;
  },
): Promise<void> {
  const response = await roomStub(ns, roomId).fetch(
    new Request("https://groxbot.internal/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId, ...opts }),
    }),
  );
  if (!response.ok) {
    throw new Error(`room init ${response.status}`);
  }
}

export async function connectRoom(
  ns: RoomNamespace,
  roomId: string,
  request: Request,
  workspaceId: string,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set(OFFICE_WORKSPACE_HEADER, workspaceId);
  return roomStub(ns, roomId).fetch(new Request(request, { headers }));
}

export async function postRoomTurn(
  ns: RoomNamespace,
  roomId: string,
  workspaceId: string,
  path: "stream" | "complete" | "error" | "abort",
  body: Record<string, unknown>,
): Promise<void> {
  const response = await roomStub(ns, roomId).fetch(
    new Request(`https://groxbot.internal/turns/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [OFFICE_WORKSPACE_HEADER]: workspaceId,
      },
      body: JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    throw new Error(`room turn ${path} ${response.status}`);
  }
}

export async function boardFileOp(
  ns: RoomNamespace,
  roomId: string,
  workspaceId: string,
  path: "list" | "read" | "write",
  body: Record<string, unknown>,
): Promise<unknown> {
  const response = await roomStub(ns, roomId).fetch(
    new Request(`https://groxbot.internal/files/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [OFFICE_WORKSPACE_HEADER]: workspaceId,
      },
      body: JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `board ${path} ${response.status}`);
  }
  return response.json();
}
