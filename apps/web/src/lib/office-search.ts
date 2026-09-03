import { parseKnowledgeHref } from "./knowledge-link";

export const DESK_PANES = ["settings", "computer", "app", "knowledge"] as const;
export type DeskPane = (typeof DESK_PANES)[number];

/** Desk on `/$workspaceSlug/bot/$botId` — back button restores the pane. */
export type OfficeSearch = {
  pane?: DeskPane;
  app?: string;
  knowledge?: string;
  library?: true;
};

const DESK_CLOSED: OfficeSearch = {};
const DESK_SETTINGS: OfficeSearch = { pane: "settings" };
const DESK_COMPUTER: OfficeSearch = { pane: "computer" };

function libraryFlag(raw: unknown): true | undefined {
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  return undefined;
}

function knowledgeFile(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const parsed = parseKnowledgeHref(raw);
  return parsed.kind === "path" ? parsed.path : undefined;
}

export function officeSearch(
  raw: Record<string, unknown> | undefined,
): OfficeSearch {
  const library = libraryFlag(raw?.library);
  const knowledge = knowledgeFile(raw?.knowledge);
  const pane = raw?.pane;
  const next: OfficeSearch = {};

  if (pane === "settings") next.pane = "settings";
  else if (pane === "computer") next.pane = "computer";
  else if (pane === "knowledge") next.pane = "knowledge";
  else if (pane === "app") {
    const app = typeof raw?.app === "string" ? raw.app.trim() : "";
    if (app) {
      next.pane = "app";
      next.app = app;
    }
  }
  if (knowledge) next.knowledge = knowledge;
  if (library) next.library = true;

  if (!next.library && !next.knowledge && !next.app) {
    if (!next.pane) return DESK_CLOSED;
    if (next.pane === "settings") return DESK_SETTINGS;
    if (next.pane === "computer") return DESK_COMPUTER;
  }
  return next;
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

export function deskPeek(path: string): OfficeSearch {
  return officeSearch({ pane: "knowledge", knowledge: path });
}

export function deskLibrary(
  current: OfficeSearch,
  path?: string | null,
): OfficeSearch {
  const knowledge = path === undefined ? current.knowledge : path;
  return officeSearch({
    ...current,
    library: true,
    knowledge: knowledge || undefined,
  });
}

export function closeLibrary(current: OfficeSearch): OfficeSearch {
  const next = { ...current };
  delete next.library;
  return officeSearch(next);
}

export function closePeek(current: OfficeSearch): OfficeSearch {
  if (current.pane !== "knowledge") return current;
  return officeSearch({
    library: current.library,
    knowledge: current.library ? current.knowledge : undefined,
  });
}

export function toggleDesk(
  current: OfficeSearch,
  pane: Exclude<DeskPane, "app" | "knowledge">,
): OfficeSearch {
  if (current.pane === pane) return deskClosed();
  return pane === "settings" ? deskSettings() : deskComputer();
}
