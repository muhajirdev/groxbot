import type { Bot, WorkspaceApp } from "@groxbot/contracts";
import { APP_KIND_LABEL } from "./app-kind";

export type PaletteBot = Pick<
  Bot,
  | "id"
  | "name"
  | "title"
  | "lastPreview"
  | "archivedAt"
  | "avatarColor"
  | "avatarShape"
>;

export type PaletteApp = Pick<WorkspaceApp, "id" | "title" | "templateId">;

export type PaletteRoom = {
  id: string;
  name: string;
  lastPreview: string;
  memberNames: string;
};

export const PALETTE_ACTIONS = [
  {
    id: "hire",
    label: "New bot",
    shortcut: "Mod+N",
    keywords: ["new", "hire", "create", "bot", "teammate"],
  },
  {
    id: "room",
    label: "New room",
    shortcut: "",
    keywords: ["new", "room", "group", "create", "table"],
  },
  {
    id: "section",
    label: "New section",
    shortcut: "",
    keywords: ["new", "section", "group", "folder", "create"],
  },
  {
    id: "settings",
    label: "Bot settings",
    shortcut: "",
    keywords: ["settings", "profile", "persona", "instructions"],
  },
  {
    id: "computer",
    label: "Computer",
    shortcut: "",
    keywords: ["computer", "desk", "files"],
  },
  {
    id: "plugins",
    label: "Plugins",
    shortcut: "",
    keywords: ["plugins", "integrations", "connect"],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    shortcut: "",
    keywords: ["knowledge", "notes", "library", "office"],
  },
  {
    id: "skills",
    label: "Skills",
    shortcut: "",
    keywords: ["skills", "playbook", "skill"],
  },
  {
    id: "workspace",
    label: "Workspace",
    shortcut: "Mod+,",
    keywords: ["workspace", "account", "theme", "models", "you"],
  },
] as const;

export type PaletteActionId = (typeof PALETTE_ACTIONS)[number]["id"];
export type PaletteAction = (typeof PALETTE_ACTIONS)[number];

export type PaletteItem =
  | { kind: "bot"; key: string; bot: PaletteBot }
  | { kind: "room"; key: string; room: PaletteRoom }
  | { kind: "app"; key: string; app: PaletteApp }
  | { kind: "action"; key: string; action: PaletteAction };

type Ranked = PaletteItem & { score: number; order: number };

function matchScore(haystack: string, needle: string): number {
  const hay = haystack.trim().toLowerCase();
  const n = needle.trim().toLowerCase();
  if (!n) return 1;
  if (!hay) return 0;
  if (hay === n) return 100;
  if (hay.startsWith(n)) return 80;
  const index = hay.indexOf(n);
  if (index >= 0) return Math.max(20, 60 - index);
  return 0;
}

function botScore(bot: PaletteBot, needle: string): number {
  const name = matchScore(bot.name, needle);
  const extra = Math.max(
    matchScore(bot.title, needle),
    matchScore(bot.lastPreview, needle),
  );
  return Math.max(name, extra * 0.5);
}

function appScore(app: PaletteApp, needle: string): number {
  return Math.max(
    matchScore(app.title, needle),
    matchScore(APP_KIND_LABEL[app.templateId], needle),
  );
}

function roomScore(room: PaletteRoom, needle: string): number {
  return Math.max(
    matchScore(room.name, needle),
    matchScore(room.lastPreview, needle),
    matchScore(room.memberNames, needle) * 0.5,
  );
}

function actionScore(action: PaletteAction, needle: string): number {
  return Math.max(
    matchScore(action.label, needle),
    ...action.keywords.map((word) => matchScore(word, needle)),
  );
}

function byRank(a: Ranked, b: Ranked): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.order - b.order;
}

/** Empty query lists live teammates, then rooms, apps, then commands. A query ranks matches. */
export function rankPaletteItems(
  query: string,
  bots: readonly PaletteBot[],
  apps: readonly PaletteApp[],
  rooms: readonly PaletteRoom[] = [],
): PaletteItem[] {
  const needle = query.trim();
  const ranked: Ranked[] = [];
  let order = 0;

  for (const bot of bots) {
    const score = botScore(bot, needle);
    if (!needle && bot.archivedAt) continue;
    if (score <= 0) continue;
    ranked.push({
      kind: "bot",
      key: `bot:${bot.id}`,
      bot,
      score,
      order: order++,
    });
  }

  for (const room of rooms) {
    const score = roomScore(room, needle);
    if (score <= 0) continue;
    ranked.push({
      kind: "room",
      key: `room:${room.id}`,
      room,
      score,
      order: order++,
    });
  }

  for (const app of apps) {
    const score = appScore(app, needle);
    if (score <= 0) continue;
    ranked.push({
      kind: "app",
      key: `app:${app.id}`,
      app,
      score,
      order: order++,
    });
  }

  for (const action of PALETTE_ACTIONS) {
    const score = actionScore(action, needle);
    if (score <= 0) continue;
    ranked.push({
      kind: "action",
      key: `action:${action.id}`,
      action,
      score,
      order: order++,
    });
  }

  if (needle) ranked.sort(byRank);
  return ranked.map(({ score: _score, order: _order, ...item }) => item);
}

export function neighborBotId(
  ids: string[],
  current: string | undefined,
  delta: 1 | -1,
): string | undefined {
  if (ids.length === 0) return undefined;
  const index = current ? ids.indexOf(current) : -1;
  if (index < 0) return delta > 0 ? ids[0] : ids[ids.length - 1];
  return ids[(index + delta + ids.length) % ids.length];
}
