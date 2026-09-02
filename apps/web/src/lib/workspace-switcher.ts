export const WORKSPACE_COMING_SOON = "Feature coming soon";

export type WorkspaceOption = {
  id: string;
  name: string;
};

export type WorkspaceMenuItem =
  | { kind: "workspace"; id: string; name: string; current: boolean }
  | { kind: "create" };

export function workspaceDisplayName(
  name: string | null | undefined,
): string {
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

/** Switching or creating another office is stubbed until multi-workspace ships. */
export function workspaceActionNotice(
  item: WorkspaceMenuItem,
): string | null {
  if (item.kind === "create") return WORKSPACE_COMING_SOON;
  if (!item.current) return WORKSPACE_COMING_SOON;
  return null;
}
