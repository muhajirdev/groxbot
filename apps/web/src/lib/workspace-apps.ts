import type { ThreadMessage, WorkspaceApp } from "@groxbot/contracts";

/** Fold live thread cards into the workspace list so a new stamp shows immediately. */
export function mergeWorkspaceApps(
  listed: WorkspaceApp[],
  messages: ThreadMessage[],
): WorkspaceApp[] {
  const byId = new Map(listed.map((app) => [app.id, app]));
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.kind !== "app") continue;
      const existing = byId.get(block.appId);
      if (!existing) {
        byId.set(block.appId, {
          id: block.appId,
          templateId: block.templateId,
          title: block.title,
          createdAt: message.createdAt,
        });
        continue;
      }
      if (message.createdAt < existing.createdAt) {
        byId.set(block.appId, { ...existing, createdAt: message.createdAt });
      } else {
        byId.set(block.appId, {
          ...existing,
          title: block.title,
          templateId: block.templateId,
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
