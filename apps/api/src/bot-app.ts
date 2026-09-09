/** Cloudflare-only. Excluded from `tsc`. Room activity → Gadget RPC. */
import { OFFICE_APP_TOOL_NAME } from "@groxbot/core";
import { z } from "zod";
import { officeAgentTool } from "./bot-office-tools.js";

type AppRuntimeStub = {
  callGadget(
    method: string,
    args: unknown[],
    workspaceId: string,
  ): Promise<unknown>;
};

type AppNamespace = {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): AppRuntimeStub;
};

export function createRoomAppTool(opts: {
  focusedAppId: () => string;
  workspaceId: () => string;
  runtime: AppNamespace;
}) {
  return officeAgentTool({
    name: OFFICE_APP_TOOL_NAME,
    description:
      "The live app this room is looking at. Everyone here has it open. method is a Gadget RPC name (getDocument, setDocument, setDeck, applyOperation, initializeBlocks, getDeck, getGame, setGame, upsertContact, move, or whatever server.js exports). arguments is the args list.",
    parameters: z.object({
      method: z.string().min(1).max(80),
      arguments: z.array(z.unknown()).optional(),
    }),
    execute: async ({ method, arguments: args }) => {
      const appId = opts.focusedAppId().trim();
      if (!appId) throw new Error("This room is not looking at an app.");
      const workspaceId = opts.workspaceId().trim();
      if (!workspaceId) throw new Error("This room is not ready yet.");
      const stub = opts.runtime.get(opts.runtime.idFromName(appId));
      return stub.callGadget(
        String(method ?? ""),
        Array.isArray(args) ? args : [],
        workspaceId,
      );
    },
  });
}
