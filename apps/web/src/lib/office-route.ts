export const OFFICE_TO = "/$workspaceSlug/bot/$botId" as const;

export function officeParams(workspaceSlug: string, botId: string) {
  return { workspaceSlug, botId };
}
