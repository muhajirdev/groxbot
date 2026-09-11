import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "groxbot.apps.seen.";
const SEED_MS = 400;

export function seenAppsKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

export function readSeenAppIds(workspaceId: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(seenAppsKey(workspaceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string" && id);
  } catch {
    return null;
  }
}

export function writeSeenAppIds(
  workspaceId: string,
  ids: readonly string[],
): void {
  try {
    sessionStorage.setItem(seenAppsKey(workspaceId), JSON.stringify([...ids]));
  } catch {
    /* private mode */
  }
}

export function freshAppIds(
  listed: readonly string[],
  seen: ReadonlySet<string> | null,
): string[] {
  if (!seen) return [];
  return listed.filter((id) => id && !seen.has(id));
}

/** Pulse only apps that appear after the first snapshot (or after a stored set). */
export function useFreshWorkspaceApps(
  workspaceId: string,
  listed: readonly { id: string }[],
): { freshIds: string[]; markSeen: () => void } {
  const [freshIds, setFreshIds] = useState<string[]>([]);
  const seeded = useRef(false);
  const seen = useRef(new Set<string>());
  const listedRef = useRef(listed);
  listedRef.current = listed;

  useEffect(() => {
    seeded.current = false;
    seen.current = new Set();
    setFreshIds([]);
    const stored = readSeenAppIds(workspaceId);
    if (stored) {
      seen.current = new Set(stored);
      seeded.current = true;
      setFreshIds(
        freshAppIds(
          listedRef.current.map((item) => item.id),
          seen.current,
        ),
      );
      return;
    }
    const timer = window.setTimeout(() => {
      if (seeded.current) return;
      seen.current = new Set(listedRef.current.map((item) => item.id));
      writeSeenAppIds(workspaceId, [...seen.current]);
      seeded.current = true;
    }, SEED_MS);
    return () => window.clearTimeout(timer);
  }, [workspaceId]);

  const listedKey = listed.map((item) => item.id).join("\0");
  useEffect(() => {
    if (!seeded.current) return;
    const ids = listedKey ? listedKey.split("\0") : [];
    const next = freshAppIds(ids, seen.current);
    if (next.length === 0) return;
    setFreshIds((prev) => {
      const merged = new Set(prev);
      let changed = false;
      for (const id of next) {
        if (merged.has(id)) continue;
        merged.add(id);
        changed = true;
      }
      return changed ? [...merged] : prev;
    });
  }, [listedKey]);

  const markSeen = useCallback(() => {
    const ids = listedRef.current.map((item) => item.id);
    seen.current = new Set(ids);
    writeSeenAppIds(workspaceId, ids);
    setFreshIds([]);
  }, [workspaceId]);

  return { freshIds, markSeen };
}
