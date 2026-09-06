import {
  AdminDeleteError,
  commitAdminUserDelete,
  commitAdminWorkspaceDelete,
  listWorkspaceApps,
  planAdminUserDelete,
  planAdminWorkspaceDelete,
  purgeDeploymentData,
  removeAvatar,
  type KnowledgeDisk,
} from "@groxbot/core";
import { bots, organization, rooms, user } from "@groxbot/db";
import { eq, isNotNull } from "drizzle-orm";
import type { RpcContext } from "./context.js";

async function purgeKnowledgePrefix(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<number> {
  const prefix = `${workspaceId}/`;
  let deleted = 0;
  while (true) {
    const objects = await disk.list(prefix);
    if (objects.length === 0) break;
    for (const object of objects) {
      await disk.delete(object.key);
      deleted++;
    }
  }
  return deleted;
}

async function bestEffort(label: string, run: () => Promise<void>) {
  try {
    await run();
    return true;
  } catch (error) {
    console.error(`[groxbot] purge ${label}`, error);
    return false;
  }
}

async function collectWorkspaceSidecars(
  context: RpcContext,
  workspaceIds: string[],
) {
  const roomIds = new Set<string>();
  const appIds = new Set<string>();
  for (const workspaceId of workspaceIds) {
    const homeRooms = await context.db
      .select({ homeRoomId: bots.homeRoomId })
      .from(bots)
      .where(eq(bots.workspaceId, workspaceId));
    for (const row of homeRooms) {
      if (row.homeRoomId) roomIds.add(row.homeRoomId);
    }
    const roomRows = await context.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.workspaceId, workspaceId));
    for (const row of roomRows) roomIds.add(row.id);
    const apps = await listWorkspaceApps(context.db, workspaceId);
    for (const app of apps) appIds.add(app.id);
  }
  return { roomIds, appIds };
}

async function destroySidecars(
  context: RpcContext,
  input: {
    workspaceIds: string[];
    extraRoomIds?: string[];
    userIds?: string[];
  },
) {
  const { roomIds, appIds } = await collectWorkspaceSidecars(
    context,
    input.workspaceIds,
  );
  for (const roomId of input.extraRoomIds ?? []) roomIds.add(roomId);

  let deletedR2Objects = 0;
  if (context.knowledgeDisk) {
    for (const workspaceId of input.workspaceIds) {
      deletedR2Objects += await purgeKnowledgePrefix(
        context.knowledgeDisk,
        workspaceId,
      );
    }
  }

  let deletedAvatars = 0;
  if (context.avatars) {
    for (const userId of input.userIds ?? []) {
      const removed = await bestEffort(`avatar ${userId}`, () =>
        removeAvatar(context.avatars!, userId),
      );
      if (removed) deletedAvatars++;
    }
  }

  let destroyedRoomActors = 0;
  for (const roomId of roomIds) {
    if (!context.forgetBot) continue;
    const destroyed = await bestEffort(`room ${roomId}`, () =>
      context.forgetBot!(roomId),
    );
    if (destroyed) destroyedRoomActors++;
  }

  let destroyedAppRuntimes = 0;
  for (const appId of appIds) {
    if (!context.forgetApp) continue;
    const destroyed = await bestEffort(`app ${appId}`, () =>
      context.forgetApp!(appId),
    );
    if (destroyed) destroyedAppRuntimes++;
  }

  return {
    deletedR2Objects,
    deletedAvatars,
    destroyedRoomActors,
    destroyedAppRuntimes,
  };
}

export async function purgeDeployment(context: RpcContext) {
  const workspaces = await context.db
    .select({ id: organization.id })
    .from(organization);
  const userRows = await context.db.select({ id: user.id }).from(user);
  const sidecars = await destroySidecars(context, {
    workspaceIds: workspaces.map((row) => row.id),
    userIds: userRows.map((row) => row.id),
    extraRoomIds: (
      await context.db
        .select({ homeRoomId: bots.homeRoomId })
        .from(bots)
        .where(isNotNull(bots.homeRoomId))
    )
      .map((row) => row.homeRoomId)
      .filter((id): id is string => Boolean(id)),
  });
  const postgres = await purgeDeploymentData(context.db);
  return { ...postgres, ...sidecars };
}

export async function deleteAdminWorkspace(
  context: RpcContext,
  workspaceId: string,
) {
  await planAdminWorkspaceDelete(context.db, workspaceId);
  const sidecars = await destroySidecars(context, {
    workspaceIds: [workspaceId],
  });
  const deleted = await commitAdminWorkspaceDelete(context.db, workspaceId);
  return {
    deletedUsers: 0,
    deletedWorkspaces: deleted ? 1 : 0,
    ...sidecars,
  };
}

export async function deleteAdminUser(context: RpcContext, userId: string) {
  const plan = await planAdminUserDelete(context.db, userId);
  const extraRoomIds = plan.ownedBots
    .map((bot) => bot.homeRoomId)
    .filter((id): id is string => Boolean(id));
  const sidecars = await destroySidecars(context, {
    workspaceIds: plan.soleWorkspaceIds,
    extraRoomIds,
    userIds: [userId],
  });
  await commitAdminUserDelete(
    context.db,
    userId,
    plan.shared,
    plan.soleWorkspaceIds,
  );
  return {
    deletedUsers: 1,
    deletedWorkspaces: plan.soleWorkspaceIds.length,
    ...sidecars,
  };
}

export { AdminDeleteError };
