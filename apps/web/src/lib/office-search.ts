export const DESK_PANES = ["settings", "computer", "app"] as const;
export type DeskPane = (typeof DESK_PANES)[number];

/** Desk on `/bot/$botId` — back button restores the pane. */
export type OfficeSearch = {
  pane?: DeskPane;
  app?: string;
};

const DESK_CLOSED: OfficeSearch = {};
const DESK_SETTINGS: OfficeSearch = { pane: "settings" };
const DESK_COMPUTER: OfficeSearch = { pane: "computer" };

export function officeSearch(
  raw: Record<string, unknown> | undefined,
): OfficeSearch {
  const pane = raw?.pane;
  if (pane === "settings") return DESK_SETTINGS;
  if (pane === "computer") return DESK_COMPUTER;
  if (pane === "app") {
    const app = typeof raw?.app === "string" ? raw.app.trim() : "";
    if (app) return { pane, app };
  }
  return DESK_CLOSED;
}

export function deskClosed(): OfficeSearch {
  return DESK_CLOSED;
}

export function deskSettings(): OfficeSearch {
  return DESK_SETTINGS;
}

export function deskComputer(): OfficeSearch {
  return DESK_COMPUTER;
}

export function deskApp(appId: string): OfficeSearch {
  return { pane: "app", app: appId };
}

export function toggleDesk(
  current: OfficeSearch,
  pane: Exclude<DeskPane, "app">,
): OfficeSearch {
  if (current.pane === pane) return deskClosed();
  return pane === "settings" ? deskSettings() : deskComputer();
}
