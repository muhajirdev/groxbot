import {
  parsePiOfficeSnapshot,
  type PiBoundMessage,
} from "@groxbot/core/browser";
import { newWebSocketRpcSession } from "capnweb";
import { officeRpcUrl } from "./office-chat-rpc";
import { peekOfficeMessages, setOfficeMessages } from "./office-messages";
import { peekRoomMessages, setRoomMessages } from "./room-messages";

export const THREAD_PREFETCH_CONCURRENCY = 2;
const SNAPSHOT_MS = 8_000;

export type ThreadPrefetchTarget = {
  kind: "office" | "room";
  roomId: string;
};

type SnapshotHost = {
  snapshot(): Promise<unknown>;
  [Symbol.dispose]?: () => void;
};

export function threadPrefetchTargets(opts: {
  bots: { id: string; homeRoomId?: string; archivedAt?: string | null }[];
  rooms: { id: string }[];
  skipRoomIds?: Iterable<string>;
  hasOffice?: (roomId: string) => boolean;
  hasRoom?: (roomId: string) => boolean;
}): ThreadPrefetchTarget[] {
  const skip = new Set(
    [...(opts.skipRoomIds ?? [])].map((id) => id.trim()).filter(Boolean),
  );
  const hasOffice = opts.hasOffice ?? ((id) => peekOfficeMessages(id) !== undefined);
  const hasRoom = opts.hasRoom ?? ((id) => peekRoomMessages(id) !== undefined);
  const seen = new Set<string>();
  const out: ThreadPrefetchTarget[] = [];

  for (const bot of opts.bots) {
    if (bot.archivedAt) continue;
    const roomId = (bot.homeRoomId || bot.id).trim();
    if (!roomId || skip.has(roomId) || seen.has(roomId) || hasOffice(roomId)) {
      continue;
    }
    seen.add(roomId);
    out.push({ kind: "office", roomId });
  }
  for (const room of opts.rooms) {
    const roomId = room.id.trim();
    if (!roomId || skip.has(roomId) || seen.has(roomId) || hasRoom(roomId)) {
      continue;
    }
    seen.add(roomId);
    out.push({ kind: "room", roomId });
  }
  return out;
}

export function storePrefetchedMessages(
  target: ThreadPrefetchTarget,
  messages: PiBoundMessage[],
): void {
  if (target.kind === "office") setOfficeMessages(target.roomId, messages);
  else setRoomMessages(target.roomId, messages);
}

export async function snapshotRoomMessages(
  roomId: string,
): Promise<PiBoundMessage[]> {
  const host = newWebSocketRpcSession<SnapshotHost>(officeRpcUrl(roomId));
  try {
    const raw = await Promise.race([
      host.snapshot(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("snapshot timeout")), SNAPSHOT_MS);
      }),
    ]);
    return parsePiOfficeSnapshot(raw)?.messages ?? [];
  } finally {
    try {
      host[Symbol.dispose]?.();
    } catch {
      // already closed
    }
  }
}

export async function prefetchThreadTargets(
  targets: ThreadPrefetchTarget[],
  opts: {
    fetch?: (roomId: string) => Promise<PiBoundMessage[]>;
    store?: (target: ThreadPrefetchTarget, messages: PiBoundMessage[]) => void;
    concurrency?: number;
    isCancelled?: () => boolean;
  } = {},
): Promise<void> {
  const fetch = opts.fetch ?? snapshotRoomMessages;
  const store = opts.store ?? storePrefetchedMessages;
  const concurrency = Math.max(1, opts.concurrency ?? THREAD_PREFETCH_CONCURRENCY);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      if (opts.isCancelled?.()) return;
      const target = targets[cursor];
      cursor += 1;
      if (!target) return;
      try {
        const messages = await fetch(target.roomId);
        if (opts.isCancelled?.()) return;
        store(target, messages);
      } catch {
        // Leave cold; a later idle pass can retry.
      }
    }
  }

  const workers = Math.min(concurrency, targets.length);
  if (workers === 0) return;
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/** After first paint. Does not belong in a route loader. */
export function scheduleThreadPrefetch(opts: {
  bots: { id: string; homeRoomId?: string; archivedAt?: string | null }[];
  rooms: { id: string }[];
  skipRoomIds?: Iterable<string>;
}): () => void {
  if (typeof window === "undefined") return () => {};
  let cancelled = false;
  let idleId = 0;
  let timer = 0;

  const start = () => {
    if (cancelled) return;
    const targets = threadPrefetchTargets(opts);
    if (targets.length === 0) return;
    void prefetchThreadTargets(targets, {
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
