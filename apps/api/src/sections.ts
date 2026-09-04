import type { SidebarSection } from "@groxbot/contracts";
import {
  createSection,
  listSections,
  removeSection,
  renameSection,
  SectionError,
} from "@groxbot/core";
import { ORPCError } from "@orpc/server";
import type { RpcContext } from "./context.js";
import type { Actor } from "./session.js";

function asOrpc(error: unknown): never {
  if (error instanceof SectionError) {
    const notFound =
      error.message === "That section is missing." ||
      error.message === "Bot not found.";
    throw new ORPCError(notFound ? "NOT_FOUND" : "BAD_REQUEST", {
      message: error.message,
    });
  }
  throw error;
}

export async function listWorkspaceSections(
  context: RpcContext,
  actor: Actor,
): Promise<SidebarSection[]> {
  return listSections(context.db, actor.workspaceId);
}

export async function createWorkspaceSection(
  context: RpcContext,
  actor: Actor,
  input: { id?: string; name: string },
): Promise<SidebarSection> {
  try {
    return await createSection(context.db, {
      workspaceId: actor.workspaceId,
      name: input.name,
      id: input.id,
    });
  } catch (error) {
    asOrpc(error);
  }
}

export async function renameWorkspaceSection(
  context: RpcContext,
  actor: Actor,
  input: { sectionId: string; name: string },
): Promise<SidebarSection> {
  try {
    return await renameSection(context.db, {
      workspaceId: actor.workspaceId,
      sectionId: input.sectionId,
      name: input.name,
    });
  } catch (error) {
    asOrpc(error);
  }
}

export async function removeWorkspaceSection(
  context: RpcContext,
  actor: Actor,
  sectionId: string,
): Promise<{ ok: true }> {
  try {
    return await removeSection(context.db, {
      workspaceId: actor.workspaceId,
      sectionId,
    });
  } catch (error) {
    asOrpc(error);
  }
}
