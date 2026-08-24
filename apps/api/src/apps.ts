import type { WorkspaceApp } from "@groxbot/contracts";
import {
  AppError,
  createWorkspaceApp,
  getWorkspaceApp,
  listWorkspaceApps,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import type { Actor } from "./session.js";
import { requireActor } from "./session.js";

function mapAppError(error: unknown): never {
  if (error instanceof AppError) {
    throw new ORPCError(error.code, { message: error.message });
  }
  throw error;
}

export async function listApps(context: RpcContext): Promise<WorkspaceApp[]> {
  const actor = await requireActor(context);
  return listWorkspaceApps(context.db, actor.workspaceId);
}

export async function getApp(
  context: RpcContext,
  appId: string,
): Promise<WorkspaceApp> {
  const actor = await requireActor(context);
  try {
    return await getWorkspaceApp(context.db, actor.workspaceId, appId);
  } catch (error) {
    return mapAppError(error);
  }
}

export async function createAppRecord(
  context: RpcContext,
  input: {
    templateId: WorkspaceApp["templateId"];
    title: string;
    botId?: string;
  },
): Promise<WorkspaceApp> {
  const actor = await requireActor(context);
  try {
    return await createWorkspaceApp({
      db: context.db,
      store: context.appStore,
      workspaceId: actor.workspaceId,
      templateId: input.templateId,
      title: input.title,
      createdByBotId: input.botId ?? null,
    });
  } catch (error) {
    return mapAppError(error);
  }
}

export async function appUiBundle(
  context: RpcContext,
  appId: string,
): Promise<{ jsCode: string } | null> {
  await getApp(context, appId);
  return context.appStore.uiBundle(appId);
}

export async function callApp(
  context: RpcContext,
  actor: Actor,
  input: { appId: string; method: string; args: unknown[] },
): Promise<unknown> {
  await getWorkspaceApp(context.db, actor.workspaceId, input.appId).catch(
    mapAppError,
  );
  const method = input.method;
  if (method !== "load" && method !== "save") {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown app method" });
  }
  return context.appStore.call(input.appId, method, input.args);
}
