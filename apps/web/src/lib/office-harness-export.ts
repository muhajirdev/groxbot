import type { Bot, ComputerEntry, ComputerFile, Routine } from "@groxbot/contracts";
import type {
  PiBoundMessage,
  PiOfficeStatus,
  PiOfficeView,
  PiToolExecution,
} from "@groxbot/core/browser";
import { peekOfficeMessages } from "./office-messages";
import { peekPiThread } from "./pi-thread-session";
import { readOfficeDebugLines } from "./office-debug";
import { client } from "./rpc";
import { readRoutines } from "./routines-cache";
import { snapshotRoomMessages } from "./thread-prefetch";

export const HARNESS_EXPORT_KIND = "groxbot.harness.v1" as const;
export const MAX_HARNESS_FILE_READS = 200;
export const HARNESS_FILE_READ_CONCURRENCY = 8;

export type HarnessComputerFile = {
  path: string;
  kind: "file" | "dir";
  size?: number;
  encoding?: "text" | "binary";
  truncated?: boolean;
  skipped?: string;
  content?: string;
};

export type HarnessExport = {
  kind: typeof HARNESS_EXPORT_KIND;
  exportedAt: string;
  bot: {
    id: string;
    name: string;
    title: string;
    model: string;
    homeRoomId: string;
    instructions: string;
    guestKind: string;
  };
  office: {
    connected: boolean;
    status: PiOfficeStatus;
    error: string;
    messages: PiBoundMessage[];
    streaming: PiBoundMessage | null;
    toolExecutions: Record<string, PiToolExecution>;
  };
  debugLog: string[];
  routines: Routine[];
  computer: {
    truncated: boolean;
    error?: string;
    files: HarnessComputerFile[];
  };
};

export type HarnessExportSource = {
  list: (botId: string) => Promise<{
    entries: ComputerEntry[];
    truncated: boolean;
  }>;
  read: (botId: string, path: string) => Promise<ComputerFile>;
  routines?: (botId: string) => Routine[] | Promise<Routine[]>;
  messages?: (roomId: string) => PiBoundMessage[] | undefined;
  snapshotMessages?: (roomId: string) => Promise<PiBoundMessage[] | undefined>;
  officeView?: (roomId: string) =>
    | { view: PiOfficeView; connected: boolean; error?: string }
    | undefined;
  debugLog?: (roomId: string) => string[];
};

export function harnessExportFilename(bot: { name: string; id: string }): string {
  const who = bot.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const day = new Date().toISOString().slice(0, 10);
  return `groxbot-${who || bot.id.slice(0, 8)}-${day}.json`;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;
      out[index] = await fn(item);
    }
  }
  const workers = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

function pickMessages(input: {
  snapshot?: PiBoundMessage[];
  live?: PiBoundMessage[];
  cached?: PiBoundMessage[];
}): PiBoundMessage[] {
  if (input.snapshot?.length) return input.snapshot;
  if (input.live?.length) return input.live;
  return input.cached ?? [];
}

export async function buildHarnessExport(
  bot: Bot,
  source: HarnessExportSource,
): Promise<HarnessExport> {
  const roomId = bot.homeRoomId || bot.id;
  const live = source.officeView?.(roomId);
  const view = live?.view;
  let snapshot: PiBoundMessage[] | undefined;
  try {
    snapshot = await source.snapshotMessages?.(roomId);
  } catch {
    snapshot = undefined;
  }
  const cached = source.messages?.(roomId);
  let listed: { entries: ComputerEntry[]; truncated: boolean } = {
    entries: [],
    truncated: false,
  };
  let computerError: string | undefined;
  try {
    listed = await source.list(bot.id);
  } catch (caught) {
    computerError =
      caught instanceof Error && caught.message.trim()
        ? caught.message.trim()
        : "Could not list computer files";
  }
  const files: HarnessComputerFile[] = [];
  let reads = 0;
  const toRead: ComputerEntry[] = [];
  for (const entry of listed.entries) {
    if (entry.kind === "dir") continue;
    if (reads >= MAX_HARNESS_FILE_READS) continue;
    reads += 1;
    toRead.push(entry);
  }
  const loaded = await mapPool(toRead, HARNESS_FILE_READ_CONCURRENCY, async (entry) => {
    try {
      const file = await source.read(bot.id, entry.path);
      const row: HarnessComputerFile = {
        path: file.path,
        kind: "file",
        size: entry.size,
        encoding: file.encoding,
        truncated: file.truncated,
        ...(file.encoding === "text"
          ? { content: file.content }
          : { skipped: "binary" }),
      };
      return row;
    } catch {
      const row: HarnessComputerFile = {
        path: entry.path,
        kind: "file",
        size: entry.size,
        skipped: "read-failed",
      };
      return row;
    }
  });
  const byPath = new Map(toRead.map((entry, index) => [entry.path, loaded[index]]));
  for (const entry of listed.entries) {
    if (entry.kind === "dir") {
      files.push({ path: entry.path, kind: "dir", size: entry.size });
      continue;
    }
    const loadedFile = byPath.get(entry.path);
    if (loadedFile) {
      files.push(loadedFile);
      continue;
    }
    files.push({
      path: entry.path,
      kind: "file",
      size: entry.size,
      skipped: "file-read-cap",
    });
  }
  let routines: Routine[] = [];
  try {
    routines = (await source.routines?.(bot.id)) ?? [];
  } catch {
    routines = [];
  }
  return {
    kind: HARNESS_EXPORT_KIND,
    exportedAt: new Date().toISOString(),
    bot: {
      id: bot.id,
      name: bot.name,
      title: bot.title,
      model: bot.model,
      homeRoomId: bot.homeRoomId,
      instructions: bot.instructions,
      guestKind: bot.guestKind,
    },
    office: {
      connected: Boolean(live?.connected),
      status: view?.status ?? "ready",
      error: live?.error || view?.error || "",
      messages: pickMessages({
        snapshot,
        live: view?.messages,
        cached,
      }),
      streaming: view?.streaming ?? null,
      toolExecutions: view?.toolExecutions ?? {},
    },
    debugLog: source.debugLog?.(roomId) ?? [],
    routines,
    computer: {
      truncated:
        listed.truncated ||
        listed.entries.filter((row) => row.kind === "file").length >
          MAX_HARNESS_FILE_READS,
      ...(computerError ? { error: computerError } : {}),
      files,
    },
  };
}

export function liveHarnessSource(input: {
  list: HarnessExportSource["list"];
  read: HarnessExportSource["read"];
}): HarnessExportSource {
  return {
    list: input.list,
    read: input.read,
    routines: async (botId) => {
      const cached = readRoutines(botId);
      if (cached.length) return cached;
      try {
        return await client.routines.list({ botId });
      } catch {
        return [];
      }
    },
    messages: peekOfficeMessages,
    snapshotMessages: async (roomId) => {
      const session = peekPiThread(roomId);
      try {
        const live = await session?.fetchSnapshot();
        if (live?.length) return live;
      } catch {
        // Fall through to a dedicated snapshot socket.
      }
      try {
        return await snapshotRoomMessages(roomId);
      } catch {
        return peekOfficeMessages(roomId);
      }
    },
    officeView: (roomId) => {
      const session = peekPiThread(roomId);
      if (!session) return undefined;
      const snap = session.getSnapshot();
      return {
        view: snap.view,
        connected: snap.connected,
        error: snap.error?.message || snap.connectionError?.message,
      };
    },
    debugLog: readOfficeDebugLines,
  };
}

export function saveHarnessExport(bundle: HarnessExport, filename: string): void {
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
