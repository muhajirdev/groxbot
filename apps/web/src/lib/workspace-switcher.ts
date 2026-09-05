export const WORKSPACE_CACHE_KEY = "groxbot.workspace";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
};

export type CachedWorkspace = {
  id: string;
  name: string;
  slug?: string;
};

export type WorkspaceMenuItem =
  | {
      kind: "workspace";
      id: string;
      name: string;
      slug: string;
      current: boolean;
    }
  | { kind: "create" };

export type WorkspaceDestination =
  | { to: "/onboarding" }
  | { to: "/room/$roomId"; roomId: string };

export function workspaceDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Workspace";
}

function workspaceStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function parseCachedWorkspace(
  raw: string | null | undefined,
): CachedWorkspace | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const id =
      "id" in parsed && typeof parsed.id === "string" ? parsed.id.trim() : "";
    const name =
      "name" in parsed && typeof parsed.name === "string"
        ? parsed.name.trim()
        : "";
    const slug =
      "slug" in parsed && typeof parsed.slug === "string"
        ? parsed.slug.trim()
        : "";
    if (!id || !name) return null;
    return slug ? { id, name, slug } : { id, name };
  } catch {
    return null;
  }
}

export function readCachedWorkspace(): CachedWorkspace | null {
  return parseCachedWorkspace(workspaceStorage()?.getItem(WORKSPACE_CACHE_KEY));
}

export function workspaceFromList<T extends { id: string; slug: string }>(
  workspaces: T[],
  slug: string,
): T | undefined {
  return (
    workspaces.find((item) => item.slug === slug) ??
    workspaces.find((item) => item.id === slug)
  );
}

/** URL slug matches the last office in localStorage — enough to stamp RPC early. */
export function workspaceFromCache(
  cached: CachedWorkspace | null,
  slug: string,
): { id: string; name: string; slug: string } | null {
  if (!cached) return null;
  if (cached.slug === slug || cached.id === slug) {
    return { id: cached.id, name: cached.name, slug: cached.slug ?? slug };
  }
  return null;
}

export function writeCachedWorkspace(input: {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
}): void {
  const id = input.id?.trim();
  const name = input.name?.trim();
  const slug = input.slug?.trim();
  if (!id || !name) return;
  workspaceStorage()?.setItem(
    WORKSPACE_CACHE_KEY,
    JSON.stringify(
      (slug ? { id, name, slug } : { id, name }) satisfies CachedWorkspace,
    ),
  );
}

export const LAST_ROOMS_KEY = "groxbot.lastRooms";

export function parseLastRooms(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [workspaceId, roomId] of Object.entries(parsed)) {
      const id = workspaceId.trim();
      const room = typeof roomId === "string" ? roomId.trim() : "";
      if (id && room) out[id] = room;
    }
    return out;
  } catch {
    return {};
  }
}

export function readLastRoom(workspaceId: string): string | null {
  const id = workspaceId.trim();
  if (!id) return null;
  return parseLastRooms(workspaceStorage()?.getItem(LAST_ROOMS_KEY))[id] ?? null;
}

export function writeLastRoom(workspaceId: string, roomId: string): void {
  const id = workspaceId.trim();
  const room = roomId.trim();
  if (!id || !room) return;
  const storage = workspaceStorage();
  if (!storage) return;
  const map = parseLastRooms(storage.getItem(LAST_ROOMS_KEY));
  if (map[id] === room) return;
  map[id] = room;
  storage.setItem(LAST_ROOMS_KEY, JSON.stringify(map));
}

export function clearLastRooms(): void {
  workspaceStorage()?.removeItem(LAST_ROOMS_KEY);
}

export function clearCachedWorkspace(): void {
  const storage = workspaceStorage();
  storage?.removeItem(WORKSPACE_CACHE_KEY);
  storage?.removeItem(LAST_ROOMS_KEY);
}

/** Live office wins; keep the last local name while `me` is still loading. */
export function resolveWorkspace(opts: {
  id?: string | null;
  name?: string | null;
  cached?: CachedWorkspace | null;
}): { id?: string; name?: string } {
  const id = opts.id?.trim() || undefined;
  const name = opts.name?.trim() || undefined;
  const cached = opts.cached;
  if (id && cached && cached.id !== id) {
    return { id, name };
  }
  return {
    id: id ?? cached?.id,
    name: name ?? cached?.name,
  };
}

export function canSaveWorkspaceName(
  current: string | null | undefined,
  draft: string,
): boolean {
  const next = draft.trim();
  return next.length > 0 && next !== (current ?? "").trim();
}

export function workspaceMenuItems(opts: {
  currentId?: string | null;
  currentName?: string | null;
  currentSlug?: string | null;
  others?: WorkspaceOption[];
}): WorkspaceMenuItem[] {
  const current = opts.currentId
    ? ([
        {
          kind: "workspace",
          id: opts.currentId,
          name: workspaceDisplayName(opts.currentName),
          slug: opts.currentSlug?.trim() || opts.currentId,
          current: true,
        },
      ] satisfies WorkspaceMenuItem[])
    : [];
  const others = (opts.others ?? [])
    .filter((item) => item.id !== opts.currentId)
    .map(
      (item): WorkspaceMenuItem => ({
        kind: "workspace",
        id: item.id,
        name: workspaceDisplayName(item.name),
        slug: item.slug || item.id,
        current: false,
      }),
    );
  return [...current, ...others, { kind: "create" }];
}

function catalogHasRoomId(
  roomId: string,
  rooms: { id: string }[],
  bots: { id: string; homeRoomId?: string }[],
): boolean {
  return (
    rooms.some((room) => room.id === roomId) ||
    bots.some((bot) => bot.homeRoomId === roomId || bot.id === roomId)
  );
}

/** Last desk in this office if we still know it; else a live teammate; empty offices hire. */
export function destinationAfterWorkspaceChange(
  bots: { id: string; homeRoomId?: string; archivedAt?: string | null }[],
  opts?: {
    lastRoomId?: string | null;
    rooms?: { id: string }[];
  },
): WorkspaceDestination {
  const lastRoomId = opts?.lastRoomId?.trim() || "";
  const rooms = opts?.rooms ?? [];
  if (lastRoomId) {
    if (bots.length === 0 && rooms.length === 0) {
      return { to: "/room/$roomId", roomId: lastRoomId };
    }
    if (catalogHasRoomId(lastRoomId, rooms, bots)) {
      return { to: "/room/$roomId", roomId: lastRoomId };
    }
  }
  const live = bots.find((bot) => !bot.archivedAt) ?? bots[0];
  if (!live) return { to: "/onboarding" };
  return { to: "/room/$roomId", roomId: live.homeRoomId || live.id };
}
