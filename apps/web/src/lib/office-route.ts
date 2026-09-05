import { deskLibrary } from "./office-search";
import { officeUrl } from "./host";

export const OFFICE_TO = "/$workspaceSlug/room/$roomId" as const;
export const ROOM_TO = OFFICE_TO;

export function officeParams(workspaceSlug: string, roomId: string) {
  return { workspaceSlug, roomId };
}

export function roomParams(workspaceSlug: string, roomId: string) {
  return { workspaceSlug, roomId };
}

/** Signed-in library URL for a note. Teammates in this office can open it. */
export function officeKnowledgePath(
  workspaceSlug: string,
  roomId: string,
  knowledgePath: string,
): string {
  const desk = deskLibrary({}, knowledgePath);
  const query = new URLSearchParams();
  query.set("library", "true");
  if (desk.knowledge) query.set("knowledge", desk.knowledge);
  return `/${workspaceSlug}/room/${roomId}?${query.toString()}`;
}

export function officeKnowledgeHref(input: {
  origin?: string;
  workspaceSlug: string;
  roomId: string;
  path: string;
}): string {
  const path = officeKnowledgePath(
    input.workspaceSlug,
    input.roomId,
    input.path,
  );
  if (input.origin) {
    return new URL(path, `${input.origin.replace(/\/$/, "")}/`).href;
  }
  return officeUrl(path);
}
