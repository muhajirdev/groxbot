import { Visibility } from "@groxbot/contracts";

export { Visibility };

export function parseVisibility(value: unknown): Visibility {
  return value === "private" ? "private" : "shared";
}

export function isPrivateVisibility(value: unknown): boolean {
  return parseVisibility(value) === "private";
}

export function isSharedVisibility(value: unknown): boolean {
  return parseVisibility(value) === "shared";
}

/** Shared roster, or this viewer’s own private teammate. */
export function botVisibleToViewer(
  bot: { visibility: string; userId: string },
  viewerUserId: string,
): boolean {
  return isSharedVisibility(bot.visibility) || bot.userId === viewerUserId;
}

/** Shared MCP, or this viewer’s own private MCP. */
export function mcpVisibleToViewer(
  row: { visibility: string; userId: string },
  viewerUserId: string,
): boolean {
  return isSharedVisibility(row.visibility) || row.userId === viewerUserId;
}

/**
 * Private bot → owner’s private MCP + office shared MCP.
 * Shared bot → shared MCP only.
 */
export function mcpBindableForBot(
  mcp: { visibility: string; userId: string },
  bot: { visibility: string; userId: string },
): boolean {
  if (isSharedVisibility(mcp.visibility)) return true;
  return isPrivateVisibility(bot.visibility) && bot.userId === mcp.userId;
}
