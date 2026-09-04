import {
  InMemorySessionStorage,
  SessionError,
  type SessionEntryCursorOptions,
  type SessionMetadata,
  type SessionStats,
  type SessionStorage,
  type SessionTreeEntry,
} from "@earendil-works/pi-agent-core";
import { jsonClone } from "@groxbot/core";

/** Official sqlite-node table names (`packages/session-backends/sqlite-node`). */
export const SQLITE_SESSIONS_TABLE = "sessions";
export const SQLITE_ENTRIES_TABLE = "entries";

/** @deprecated Use {@link SQLITE_ENTRIES_TABLE}. Kept so older call sites still compile. */
export const PI_SESSION_ENTRIES_TABLE = SQLITE_ENTRIES_TABLE;
/** @deprecated Use {@link SQLITE_SESSIONS_TABLE}. */
export const PI_SESSION_META_TABLE = SQLITE_SESSIONS_TABLE;

const LEGACY_ENTRIES_TABLE = "pi_session_entries";
const LEGACY_META_TABLE = "pi_session_meta";

/** sqlite-node `storage_version` / AgentHarness storage format 4. */
export const SQLITE_NODE_STORAGE_VERSION = 1;

const COLUMN_FIELDS = new Set([
  "id",
  "parentId",
  "seq",
  "timestamp",
  "type",
  "customType",
]);

/** Cloudflare `SqlStorage.exec` / a test double. */
export type SqlExec = {
  exec(
    query: string,
    ...binds: unknown[]
  ): { toArray: <T extends Record<string, unknown>>() => T[] };
};

export type SessionEntryStore = {
  load(): Promise<{
    metadata: SessionMetadata;
    entries: SessionTreeEntry[];
  }>;
  save(entry: SessionTreeEntry): Promise<void>;
};

type EntryRow = {
  id: string;
  parent_id: string | null;
  seq: number;
  type: string;
  custom_type: string | null;
  timestamp: number;
  payload: string;
};

type SessionRow = {
  id: string;
  created_at: number;
  next_seq: number;
};

/**
 * Official sqlite-node `001_initial.sql` (sessions + entries + caches).
 * One session per Durable Object; we persist the 0.83 `SessionTreeEntry` tree
 * into `entries` with the same column/payload split. scalar/list/usage/branch
 * tables exist so the file matches sqlite-node; 0.83 `SessionStorage` does not
 * write them.
 */
const SQLITE_NODE_DDL = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    parent_session_id TEXT,
    storage_version INTEGER NOT NULL,
    metadata TEXT,
    message_count INTEGER NOT NULL,
    usage_payload TEXT NOT NULL,
    next_seq INTEGER NOT NULL
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS entries (
    session_id TEXT NOT NULL,
    id TEXT NOT NULL,
    parent_id TEXT,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    custom_type TEXT,
    timestamp INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS ix_entry_parent ON entries(session_id, parent_id)`,
  `CREATE INDEX IF NOT EXISTS ix_entry_seq ON entries(session_id, seq, type)`,
  `CREATE TABLE IF NOT EXISTS scalar_values (
    session_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    seq INTEGER NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (session_id, namespace, key)
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS list_values (
    session_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    seq INTEGER NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (session_id, namespace, key, seq)
  ) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS usage_ledger (
    session_id TEXT NOT NULL,
    id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    entry_id TEXT,
    adjustment INTEGER NOT NULL,
    usage TEXT NOT NULL,
    details TEXT,
    PRIMARY KEY (session_id, id)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS ix_usage_seq ON usage_ledger(session_id, seq)`,
  `CREATE TRIGGER IF NOT EXISTS trg_entries_validate
    BEFORE INSERT ON entries
    BEGIN
      SELECT RAISE(ABORT, 'missing parent entry')
      WHERE NEW.parent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM entries WHERE session_id = NEW.session_id AND id = NEW.parent_id
      );
      SELECT RAISE(ABORT, 'duplicate entry or usage id')
      WHERE EXISTS (
        SELECT 1 FROM usage_ledger WHERE session_id = NEW.session_id AND id = NEW.id
      );
    END`,
  `CREATE TRIGGER IF NOT EXISTS trg_usage_ledger_validate
    BEFORE INSERT ON usage_ledger
    BEGIN
      SELECT RAISE(ABORT, 'duplicate entry or usage id')
      WHERE EXISTS (
        SELECT 1 FROM entries WHERE session_id = NEW.session_id AND id = NEW.id
      );
    END`,
  `CREATE TABLE IF NOT EXISTS branch_entries (
    session_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    entry_seq INTEGER NOT NULL,
    entry_type TEXT NOT NULL,
    PRIMARY KEY (session_id, branch_id, entry_id)
  ) WITHOUT ROWID`,
  `CREATE INDEX IF NOT EXISTS ix_be_seq ON branch_entries(session_id, branch_id, entry_seq, entry_id, entry_type)`,
  `CREATE INDEX IF NOT EXISTS ix_be_type ON branch_entries(session_id, branch_id, entry_type, entry_seq, entry_id)`,
  `CREATE INDEX IF NOT EXISTS ix_be_entry ON branch_entries(session_id, entry_id)`,
  `CREATE TABLE IF NOT EXISTS branch_meta (
    session_id TEXT NOT NULL,
    branch_id TEXT NOT NULL,
    tip_entry_id TEXT NOT NULL,
    tip_seq INTEGER NOT NULL,
    base_branch_id TEXT,
    base_seq INTEGER,
    PRIMARY KEY (session_id, branch_id)
  ) WITHOUT ROWID`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ix_bm_tip ON branch_meta(session_id, tip_entry_id)`,
];

export function ensurePiSessionTables(sql: SqlExec): void {
  for (const statement of SQLITE_NODE_DDL) {
    sql.exec(statement);
  }
  migrateLegacyPiSessionTables(sql);
}

export function sqliteSessionStore(
  sql: SqlExec,
  fallback: SessionMetadata,
): SessionEntryStore {
  return {
    async load() {
      ensurePiSessionTables(sql);
      const sessionId = readOrCreateSession(sql, fallback);
      const rows = sql
        .exec(
          `SELECT id, parent_id, seq, type, custom_type, timestamp, payload
           FROM ${SQLITE_ENTRIES_TABLE}
           WHERE session_id = ?
           ORDER BY seq ASC`,
          sessionId,
        )
        .toArray() as EntryRow[];
      const entries = rows.flatMap((row) => {
        try {
          return [decodeEntryRow(row)];
        } catch {
          return [];
        }
      });
      const session = readSessionRow(sql, sessionId);
      return {
        metadata: {
          id: sessionId,
          createdAt: timestampIso(session?.created_at ?? Date.parse(fallback.createdAt)),
        },
        entries,
      };
    },
    async save(entry) {
      ensurePiSessionTables(sql);
      const sessionId = readOrCreateSession(sql, fallback);
      insertEntryRow(sql, sessionId, entry);
    },
  };
}

/** Pi `SessionStorage` that journals every append onto Durable Object SQLite. */
export class DurableSessionStorage<
  TMetadata extends SessionMetadata = SessionMetadata,
> implements SessionStorage<TMetadata> {
  private inner: InMemorySessionStorage<TMetadata> | null = null;

  constructor(private readonly persist: SessionEntryStore) {}

  private async ready(): Promise<InMemorySessionStorage<TMetadata>> {
    if (this.inner) return this.inner;
    const loaded = await this.persist.load();
    this.inner = new InMemorySessionStorage<TMetadata>({
      entries: loaded.entries,
      metadata: loaded.metadata as TMetadata,
    });
    return this.inner;
  }

  async getMetadata(): Promise<TMetadata> {
    return (await this.ready()).getMetadata();
  }

  async getLeafId(): Promise<string | null> {
    return (await this.ready()).getLeafId();
  }

  async setLeafId(leafId: string | null): Promise<void> {
    const inner = await this.ready();
    if (leafId !== null && !(await inner.getEntry(leafId))) {
      throw new SessionError("not_found", `Entry ${leafId} not found`);
    }
    const entry: SessionTreeEntry = {
      type: "leaf",
      id: await inner.createEntryId(),
      parentId: await inner.getLeafId(),
      timestamp: new Date().toISOString(),
      targetId: leafId,
    };
    await this.persist.save(entry);
    await inner.appendEntry(entry);
  }

  async createEntryId(): Promise<string> {
    return (await this.ready()).createEntryId();
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    const plain = jsonClone(entry) ?? entry;
    await this.persist.save(plain);
    await (await this.ready()).appendEntry(plain);
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    return (await this.ready()).getEntry(id);
  }

  async findEntries<TType extends SessionTreeEntry["type"]>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
    return (await this.ready()).findEntries(type);
  }

  async getLabel(id: string): Promise<string | undefined> {
    return (await this.ready()).getLabel(id);
  }

  async getSessionName(): Promise<string | undefined> {
    return (await this.ready()).getSessionName();
  }

  async getSessionStats(): Promise<SessionStats> {
    return (await this.ready()).getSessionStats();
  }

  async getPathToRootOrCompaction(
    leafId: string | null,
  ): Promise<SessionTreeEntry[]> {
    return (await this.ready()).getPathToRootOrCompaction(leafId);
  }

  async getEntries(
    options?: SessionEntryCursorOptions,
  ): Promise<SessionTreeEntry[]> {
    return (await this.ready()).getEntries(options);
  }
}

export function entryPayload(
  entry: SessionTreeEntry,
): Record<string, unknown> {
  const cloned = jsonClone(entry) ?? { id: entry.id, type: entry.type };
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cloned as Record<string, unknown>)) {
    if (COLUMN_FIELDS.has(key) || value === undefined) continue;
    payload[key] = value;
  }
  return payload;
}

export function decodeEntryRow(row: EntryRow): SessionTreeEntry {
  const parsed = JSON.parse(row.payload) as unknown;
  const payload =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const base = {
    id: row.id,
    parentId: row.parent_id,
    timestamp: timestampIso(row.timestamp),
    type: row.type,
  };
  if (row.type === "custom" || row.type === "custom_message") {
    const customType =
      row.custom_type ??
      (typeof payload.customType === "string" ? payload.customType : "");
    return {
      ...payload,
      ...base,
      customType,
    } as SessionTreeEntry;
  }
  return { ...payload, ...base } as SessionTreeEntry;
}

function customTypeOf(entry: SessionTreeEntry): string | null {
  return "customType" in entry && typeof entry.customType === "string"
    ? entry.customType
    : null;
}

function timestampMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : Date.now();
}

function timestampIso(ms: number): string {
  const date = new Date(ms);
  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : new Date().toISOString();
}

function tableExists(sql: SqlExec, name: string): boolean {
  const rows = sql
    .exec(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      name,
    )
    .toArray() as Array<{ name: string }>;
  return rows.some((row) => row.name === name);
}

function countRows(sql: SqlExec, table: string, sessionId?: string): number {
  const rows = sessionId
    ? sql
        .exec(
          `SELECT COUNT(*) AS n FROM ${table} WHERE session_id = ?`,
          sessionId,
        )
        .toArray()
    : sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).toArray();
  const n = (rows[0] as { n?: number | bigint } | undefined)?.n;
  return typeof n === "bigint" ? Number(n) : typeof n === "number" ? n : 0;
}

function readSessionRow(sql: SqlExec, sessionId: string): SessionRow | null {
  const rows = sql
    .exec(
      `SELECT id, created_at, next_seq FROM ${SQLITE_SESSIONS_TABLE} WHERE id = ?`,
      sessionId,
    )
    .toArray() as SessionRow[];
  return rows[0] ?? null;
}

function insertSessionRow(sql: SqlExec, metadata: SessionMetadata): void {
  sql.exec(
    `INSERT INTO ${SQLITE_SESSIONS_TABLE} (
      id, created_at, parent_session_id, storage_version, metadata,
      message_count, usage_payload, next_seq
    ) VALUES (?, ?, NULL, ?, NULL, 0, '{}', 1)`,
    metadata.id,
    timestampMs(metadata.createdAt),
    SQLITE_NODE_STORAGE_VERSION,
  );
}

function readOrCreateSession(sql: SqlExec, fallback: SessionMetadata): string {
  const existing = sql
    .exec(`SELECT id FROM ${SQLITE_SESSIONS_TABLE} LIMIT 1`)
    .toArray() as Array<{ id: string }>;
  const id = existing[0]?.id;
  if (id) return id;
  insertSessionRow(sql, fallback);
  return fallback.id;
}

function insertEntryRow(
  sql: SqlExec,
  sessionId: string,
  entry: SessionTreeEntry,
  seqOverride?: number,
): void {
  const session = readSessionRow(sql, sessionId);
  const seq = seqOverride ?? session?.next_seq ?? 1;
  sql.exec(
    `INSERT INTO ${SQLITE_ENTRIES_TABLE} (
      session_id, id, parent_id, seq, type, custom_type, timestamp, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    entry.id,
    entry.parentId,
    seq,
    entry.type,
    customTypeOf(entry),
    timestampMs(entry.timestamp),
    JSON.stringify(entryPayload(entry)),
  );
  const messageBump = entry.type === "message" ? 1 : 0;
  const nextSeq = Math.max(session?.next_seq ?? 1, seq) + 1;
  sql.exec(
    `UPDATE ${SQLITE_SESSIONS_TABLE}
     SET next_seq = ?,
         message_count = message_count + ?
     WHERE id = ?`,
    nextSeq,
    messageBump,
    sessionId,
  );
}

function migrateLegacyPiSessionTables(sql: SqlExec): void {
  if (!tableExists(sql, LEGACY_ENTRIES_TABLE)) {
    if (tableExists(sql, LEGACY_META_TABLE)) {
      sql.exec(`DROP TABLE IF EXISTS ${LEGACY_META_TABLE}`);
    }
    return;
  }
  if (countRows(sql, SQLITE_ENTRIES_TABLE) > 0) {
    sql.exec(`DROP TABLE IF EXISTS ${LEGACY_ENTRIES_TABLE}`);
    sql.exec(`DROP TABLE IF EXISTS ${LEGACY_META_TABLE}`);
    return;
  }

  const metaRows = tableExists(sql, LEGACY_META_TABLE)
    ? (sql
        .exec(`SELECT key, value FROM ${LEGACY_META_TABLE}`)
        .toArray() as Array<{ key: string; value: string }>)
    : [];
  const meta = Object.fromEntries(metaRows.map((row) => [row.key, row.value]));
  const fallbackId = meta.id?.trim() || "session";
  const fallbackCreatedAt =
    meta.createdAt?.trim() || new Date(0).toISOString();
  if (!readSessionRow(sql, fallbackId) && countRows(sql, SQLITE_SESSIONS_TABLE) === 0) {
    insertSessionRow(sql, { id: fallbackId, createdAt: fallbackCreatedAt });
  }
  const sessionId = readOrCreateSession(sql, {
    id: fallbackId,
    createdAt: fallbackCreatedAt,
  });

  const legacy = sql
    .exec(
      `SELECT seq, entry FROM ${LEGACY_ENTRIES_TABLE} ORDER BY seq ASC`,
    )
    .toArray() as Array<{ seq: number; entry: string }>;
  for (const row of legacy) {
    try {
      const entry = JSON.parse(row.entry) as SessionTreeEntry;
      insertEntryRow(sql, sessionId, entry, row.seq);
    } catch {
      continue;
    }
  }

  sql.exec(`DROP TABLE IF EXISTS ${LEGACY_ENTRIES_TABLE}`);
  sql.exec(`DROP TABLE IF EXISTS ${LEGACY_META_TABLE}`);
}
