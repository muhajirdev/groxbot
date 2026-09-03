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
  | { to: "/bot/$botId"; botId: string };

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

export function clearCachedWorkspace(): void {
  workspaceStorage()?.removeItem(WORKSPACE_CACHE_KEY);
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

/** Empty offices hire first; otherwise open a live teammate. */
export function destinationAfterWorkspaceChange(
  bots: { id: string; archivedAt?: string | null }[],
): WorkspaceDestination {
  const live = bots.find((bot) => !bot.archivedAt) ?? bots[0];
  if (!live) return { to: "/onboarding" };
  return { to: "/bot/$botId", botId: live.id };
}
