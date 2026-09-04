export const OFFICE_TO = "/$workspaceSlug/room/$roomId" as const;
export const ROOM_TO = OFFICE_TO;

export function officeParams(workspaceSlug: string, roomId: string) {
  return { workspaceSlug, roomId };
}

export function roomParams(workspaceSlug: string, roomId: string) {
  return { workspaceSlug, roomId };
}
