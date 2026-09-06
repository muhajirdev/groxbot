import {
  AdminDeleteError,
  adminStats,
  listAdminUsers,
  listAdminWorkspaces,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import {
  deleteAdminUser,
  deleteAdminWorkspace,
  purgeDeployment,
} from "./admin-purge.js";
import type { RpcContext } from "./context.js";
import { requireDeploymentOwner } from "./session.js";

export async function requireAdmin(context: RpcContext) {
  await requireDeploymentOwner(context);
}

function throwAdminDelete(error: unknown): never {
  if (error instanceof AdminDeleteError) {
    throw new ORPCError(error.code, { message: error.message });
  }
  throw error;
}

export async function getAdminStats(context: RpcContext) {
  await requireAdmin(context);
  return adminStats(context.db);
}

export async function getAdminUsers(
  context: RpcContext,
  input: { limit: number; offset: number; search?: string },
) {
  await requireAdmin(context);
  return listAdminUsers(context.db, input);
}

export async function getAdminWorkspaces(
  context: RpcContext,
  input: { limit: number; offset: number; search?: string },
) {
  await requireAdmin(context);
  return listAdminWorkspaces(context.db, input);
}

export async function deleteAdminUserAccount(
  context: RpcContext,
  userId: string,
) {
  const actor = await requireDeploymentOwner(context);
  if (actor.userId === userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Cannot delete the signed-in owner.",
    });
  }
  try {
    return await deleteAdminUser(context, userId);
  } catch (error) {
    throwAdminDelete(error);
  }
}

export async function deleteAdminWorkspaceAccount(
  context: RpcContext,
  workspaceId: string,
) {
  await requireAdmin(context);
  try {
    return await deleteAdminWorkspace(context, workspaceId);
  } catch (error) {
    throwAdminDelete(error);
  }
}

export async function purgeAdminData(context: RpcContext) {
  await requireAdmin(context);
  return purgeDeployment(context);
}
