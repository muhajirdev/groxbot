import type { OfficeUserMeta } from "@groxbot/contracts";
import {
  OFFICE_WORKSPACE_HEADER,
  parseOfficeChatMessages,
} from "@groxbot/core";
import { getAgentByName } from "agents";
import { newWorkersRpcResponse, RpcTarget } from "capnweb";
import type { RoomHome } from "./bot-actor.js";

export { OFFICE_WORKSPACE_HEADER };

export type OfficeChatSubscriber = {
  streamGeneration(generation: number): void | Promise<void>;
  message(row: unknown): void | Promise<void>;
  stream(update: { message: unknown }): void | Promise<void>;
  status(status: string): void | Promise<void>;
  error(message: string): void | Promise<void>;
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

  subscribe(subscriber: OfficeChatSubscriber): Promise<void> {
    return this.actor.subscribeOffice(subscriber);
  }

  run(messages: unknown): Promise<void> {
    return this.actor.runOffice(parseOfficeChatMessages(messages), this.user);
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
