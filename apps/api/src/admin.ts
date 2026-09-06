import {
  adminStats,
  listAdminUsers,
  listAdminWorkspaces,
} from "@groxbot/core";
import { purgeDeployment } from "./admin-purge.js";
import type { RpcContext } from "./context.js";
import { requireDeploymentOwner } from "./session.js";

export async function requireAdmin(context: RpcContext) {
  await requireDeploymentOwner(context);
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

export async function purgeAdminData(context: RpcContext) {
  await requireAdmin(context);
  return purgeDeployment(context);
}
