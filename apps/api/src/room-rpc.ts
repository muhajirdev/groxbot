/** Cloudflare-only. Excluded from `tsc`. Cap’n Web host for a group RoomActor. */
import type { OfficeUserMeta } from "@groxbot/contracts";
import {
  OFFICE_WORKSPACE_HEADER,
  parsePiSendMessageInput,
} from "@groxbot/core";
import { getAgentByName } from "agents";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import type { OfficeChatSubscriber } from "./bot-office-rpc.js";

export { OFFICE_WORKSPACE_HEADER };

export type RoomChatSubscriber = OfficeChatSubscriber;

type RoomChatActor = {
  snapshotRoom(): Promise<unknown>;
  subscribeRoom(subscriber: RoomChatSubscriber): Promise<void>;
  sendRoom(
    input: NonNullable<ReturnType<typeof parsePiSendMessageInput>>,
    user: OfficeUserMeta | null,
  ): Promise<void>;
  stopRoom(): Promise<void>;
};

export class RoomChatHost extends RpcTarget {
  constructor(
    private readonly actor: RoomChatActor,
    private readonly user: OfficeUserMeta | null,
  ) {
    super();
  }

  snapshot(): Promise<unknown> {
    return this.actor.snapshotRoom();
  }

  subscribe(subscriber: RoomChatSubscriber): Promise<void> {
    return this.actor.subscribeRoom(subscriber);
  }

  send(input: unknown): Promise<void> {
    const parsed = parsePiSendMessageInput(input);
    if (!parsed) return Promise.resolve();
    return this.actor.sendRoom(parsed, this.user);
  }

  stop(): Promise<void> {
    return this.actor.stopRoom();
  }
}

export function roomRpcResponse(
  actor: RoomChatActor,
  request: Request,
  user: OfficeUserMeta | null,
): Response | Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  return newWorkersRpcResponse(request, new RoomChatHost(actor, user));
}

type RoomNamespace = DurableObjectNamespace;

export async function initRoomActor(
  ns: RoomNamespace,
  roomId: string,
  opts: {
    workspaceId: string;
    name: string;
    botId?: string;
    members: Array<{ id: string; name: string; homeRoomId?: string }>;
  },
): Promise<void> {
  const stub = await getAgentByName(ns, roomId);
  const response = await stub.fetch(
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
  const stub = await getAgentByName(ns, roomId);
  const headers = new Headers(request.headers);
  headers.set(OFFICE_WORKSPACE_HEADER, workspaceId);
  return stub.fetch(new Request(request, { headers }));
}

export async function postRoomTurn(
  ns: RoomNamespace,
  roomId: string,
  workspaceId: string,
  path: "stream" | "complete" | "error" | "abort",
  body: Record<string, unknown>,
): Promise<void> {
  const stub = await getAgentByName(ns, roomId);
  const response = await stub.fetch(
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

export async function roomFileOp(
  ns: RoomNamespace,
  roomId: string,
  workspaceId: string,
  path: "list" | "read" | "write",
  body: Record<string, unknown>,
): Promise<unknown> {
  const stub = await getAgentByName(ns, roomId);
  const response = await stub.fetch(
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
    throw new Error(text || `room ${path} ${response.status}`);
  }
  return response.json();
}
