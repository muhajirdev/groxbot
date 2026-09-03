export type WorkspaceOption = {
  id: string;
  name: string;
};

export type WorkspaceMenuItem =
  | { kind: "workspace"; id: string; name: string; current: boolean }
  | { kind: "create" };

export type WorkspaceDestination =
  | { to: "/onboarding" }
  | { to: "/$botId"; botId: string };

export function workspaceDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed || "Workspace";
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
  others?: WorkspaceOption[];
}): WorkspaceMenuItem[] {
  const current = opts.currentId
    ? ([
        {
          kind: "workspace",
          id: opts.currentId,
          name: workspaceDisplayName(opts.currentName),
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
  return { to: "/$botId", botId: live.id };
}
