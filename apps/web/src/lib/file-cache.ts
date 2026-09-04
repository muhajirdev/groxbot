import type { QueryClient } from "@tanstack/react-query";
import {
  computerPreviewKind,
  computerPreviewSource,
  isMarkdownPreview,
} from "./computer-preview";
import { OFFICE_MESSAGES_GC_TIME } from "./office-messages";
import { orpc } from "./orpc";

/** Same cap as Worker `knowledge.read` / `computer.read`. */
export const FILE_BODY_MAX_CHARS = 64_000;
export const FILE_BODY_STALE_TIME = 60_000;

/** Prefetch every matching text file when the hit list is this small. */
export const FILE_PREFETCH_ALL_MAX = 4;

/** After paint. Not during persist restore. */
export const FILE_IDLE_PREFETCH_MAX = 32;
export const FILE_IDLE_PREFETCH_CONCURRENCY = 2;

export type KnowledgePrefetchEntry = {
  path: string;
  name?: string;
  encoding?: string;
  mediaType?: string;
};

export function isCacheableTextPreview(path: string, mediaType = ""): boolean {
  return computerPreviewSource(computerPreviewKind(path, mediaType)) === "read";
}

export function isPersistableFileBody(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const file = data as { encoding?: unknown; content?: unknown };
  if (file.encoding === "binary") return false;
  return (
    typeof file.content === "string" &&
    file.content.length <= FILE_BODY_MAX_CHARS
  );
}

export function knowledgeReadQueryOptions(path: string) {
  return {
    ...orpc.knowledge.read.queryOptions({ input: { path } }),
    staleTime: FILE_BODY_STALE_TIME,
    gcTime: OFFICE_MESSAGES_GC_TIME,
  };
}

export function computerReadQueryOptions(botId: string, path: string) {
  return {
    ...orpc.computer.read.queryOptions({ input: { botId, path } }),
    staleTime: FILE_BODY_STALE_TIME,
    gcTime: OFFICE_MESSAGES_GC_TIME,
  };
}

export function prefetchKnowledgeFiles(
  client: QueryClient,
  paths: readonly string[],
): void {
  const seen = new Set<string>();
  for (const path of paths) {
    const next = path.trim();
    if (!next || seen.has(next) || !isCacheableTextPreview(next)) continue;
    seen.add(next);
    void client.prefetchQuery(knowledgeReadQueryOptions(next));
  }
}

function idleRank(entry: KnowledgePrefetchEntry, prefer: string): number {
  if (prefer && entry.path === prefer) return 0;
  const name = entry.name || entry.path.split("/").filter(Boolean).at(-1) || "";
  if (name === "SKILL.md") return 1;
  if (isMarkdownPreview(entry.path, entry.mediaType ?? "")) return 2;
  return 3;
}

/** Text notes to warm after paint. Skip binaries, cached hits, and a flood. */
export function knowledgeIdlePrefetchPaths(
  entries: readonly KnowledgePrefetchEntry[],
  opts: {
    prefer?: string;
    hasCached?: (path: string) => boolean;
    limit?: number;
  } = {},
): string[] {
  const limit = opts.limit ?? FILE_IDLE_PREFETCH_MAX;
  const prefer = opts.prefer?.trim() ?? "";
  const cached = opts.hasCached ?? (() => false);
  const ranked = entries
    .filter((entry) => {
      const path = entry.path.trim();
      if (!path) return false;
      if (entry.encoding === "binary") return false;
      if (!isCacheableTextPreview(path, entry.mediaType)) return false;
      if (cached(path)) return false;
      return true;
    })
    .sort(
      (a, b) =>
        idleRank(a, prefer) - idleRank(b, prefer) ||
        a.path.localeCompare(b.path),
    );
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (path: string, mediaType = "") => {
    const next = path.trim();
    if (!next || seen.has(next) || out.length >= limit) return;
    if (!isCacheableTextPreview(next, mediaType) || cached(next)) return;
    seen.add(next);
    out.push(next);
  };
  add(prefer);
  for (const entry of ranked) add(entry.path, entry.mediaType);
  return out;
}

export async function prefetchKnowledgeFilesIdle(
  client: QueryClient,
  paths: readonly string[],
  opts: {
    concurrency?: number;
    isCancelled?: () => boolean;
  } = {},
): Promise<void> {
  const concurrency = Math.max(
    1,
    opts.concurrency ?? FILE_IDLE_PREFETCH_CONCURRENCY,
  );
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < paths.length) {
      if (opts.isCancelled?.()) return;
      const path = paths[cursor];
      cursor += 1;
      if (!path) return;
      try {
        await client.prefetchQuery(knowledgeReadQueryOptions(path));
      } catch {
        // Leave cold; a later idle pass can retry.
      }
    }
  }

  const workers = Math.min(concurrency, paths.length);
  if (workers === 0) return;
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/** After first paint. Does not belong in a route loader. */
export function scheduleKnowledgeFilePrefetch(
  client: QueryClient,
  opts: {
    entries: readonly KnowledgePrefetchEntry[];
    prefer?: string;
  },
): () => void {
  if (typeof window === "undefined") return () => {};
  let cancelled = false;
  let idleId = 0;
  let timer = 0;

  const start = () => {
    if (cancelled) return;
    const paths = knowledgeIdlePrefetchPaths(opts.entries, {
      prefer: opts.prefer,
      hasCached: (path) =>
        client.getQueryData(knowledgeReadQueryOptions(path).queryKey) !==
        undefined,
    });
    if (paths.length === 0) return;
    void prefetchKnowledgeFilesIdle(client, paths, {
      isCancelled: () => cancelled,
    });
  };

  const ric = window.requestIdleCallback?.bind(window);
  if (typeof ric === "function") {
    idleId = ric(start, { timeout: 2_000 });
  } else {
    timer = window.setTimeout(start, 1);
  }

  return () => {
    cancelled = true;
    if (idleId && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleId);
    }
    if (timer) window.clearTimeout(timer);
  };
}
