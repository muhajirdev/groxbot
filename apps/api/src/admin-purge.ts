import {
  listWorkspaceApps,
  purgeDeploymentData,
  removeAvatar,
  type KnowledgeDisk,
} from "@groxbot/core";
import { bots, organization, rooms, user } from "@groxbot/db";
import { isNotNull } from "drizzle-orm";
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

export async function purgeDeployment(context: RpcContext) {
  const workspaces = await context.db
    .select({ id: organization.id })
    .from(organization);
  const userRows = await context.db.select({ id: user.id }).from(user);

  const roomIds = new Set<string>();
  const homeRooms = await context.db
    .select({ homeRoomId: bots.homeRoomId })
    .from(bots)
    .where(isNotNull(bots.homeRoomId));
  for (const row of homeRooms) {
    if (row.homeRoomId) roomIds.add(row.homeRoomId);
  }
  const roomRows = await context.db.select({ id: rooms.id }).from(rooms);
  for (const row of roomRows) roomIds.add(row.id);

  const appIds = new Set<string>();
  for (const workspace of workspaces) {
    const apps = await listWorkspaceApps(context.db, workspace.id);
    for (const app of apps) appIds.add(app.id);
  }

  let deletedR2Objects = 0;
  if (context.knowledgeDisk) {
    for (const workspace of workspaces) {
      deletedR2Objects += await purgeKnowledgePrefix(
        context.knowledgeDisk,
        workspace.id,
      );
    }
  }

  let deletedAvatars = 0;
  if (context.avatars) {
    for (const row of userRows) {
      const removed = await bestEffort(`avatar ${row.id}`, () =>
        removeAvatar(context.avatars!, row.id),
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

  const postgres = await purgeDeploymentData(context.db);

  return {
    ...postgres,
    deletedR2Objects,
    deletedAvatars,
    destroyedRoomActors,
    destroyedAppRuntimes,
  };
}
