export const OFFICE_TO = "/$workspaceSlug/bot/$botId" as const;
export const ROOM_TO = "/$workspaceSlug/room/$roomId" as const;

export function officeParams(workspaceSlug: string, botId: string) {
  return { workspaceSlug, botId };
}

export function roomParams(workspaceSlug: string, roomId: string) {
  return { workspaceSlug, roomId };
}
