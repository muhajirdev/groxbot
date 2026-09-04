import type { OfficeUserMeta } from "@groxbot/contracts";
import {
  OFFICE_WORKSPACE_HEADER,
  parsePiSendMessageInput,
} from "@groxbot/core";
import { getAgentByName } from "agents";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import type { RoomHome } from "./bot-actor.js";

export { OFFICE_WORKSPACE_HEADER };

export type OfficeChatSubscriber = {
  streamGeneration(generation: number): void | Promise<void>;
  event(ev: unknown): void | Promise<void>;
  status(status: string): void | Promise<void>;
  error(message: string): void | Promise<void>;
  /** @deprecated UIMessage wire. Kept so old tabs fail closed instead of hanging. */
  message?(row: unknown): void | Promise<void>;
  stream?(update: { message: unknown }): void | Promise<void>;
  dup?: () => OfficeChatSubscriber;
  onRpcBroken?: (callback: () => void) => void;
};

export class OfficeChatHost extends RpcTarget {
  constructor(
    private readonly actor: RoomHome,
    private readonly user: OfficeUserMeta | null,
  ) {
    super();
  }

  snapshot(): Promise<unknown> {
    return this.actor.officeSnapshot();
  }

  subscribe(subscriber: OfficeChatSubscriber): Promise<void> {
    return this.actor.subscribeOffice(subscriber);
  }

  send(input: unknown): Promise<void> {
    const parsed = parsePiSendMessageInput(input);
    if (!parsed) return Promise.resolve();
    return this.actor.sendOffice(parsed, this.user);
  }

  stop(): Promise<void> {
    return this.actor.stopOffice();
  }
}

export function officeRpcResponse(
  actor: RoomHome,
  request: Request,
  user: OfficeUserMeta | null,
): Response | Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }
  return newWorkersRpcResponse(request, new OfficeChatHost(actor, user));
}

type BotNamespace = DurableObjectNamespace;

export async function connectBotOffice(
  ns: BotNamespace,
  botId: string,
  request: Request,
  workspaceId: string,
): Promise<Response> {
  const stub = await getAgentByName(ns, botId);
  const headers = new Headers(request.headers);
  headers.set(OFFICE_WORKSPACE_HEADER, workspaceId);
  return stub.fetch(new Request(request, { headers }));
}
