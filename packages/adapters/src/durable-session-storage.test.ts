import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { Session } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  DurableSessionStorage,
  SQLITE_ENTRIES_TABLE,
  SQLITE_SESSIONS_TABLE,
  decodeEntryRow,
  entryPayload,
  ensurePiSessionTables,
  sqliteSessionStore,
  type SqlExec,
} from "./durable-session-storage.js";

function wrapSqlite(db: DatabaseSync): SqlExec {
  return {
    exec(query: string, ...binds: unknown[]) {
      const trimmed = query.trim();
      if (/^select/i.test(trimmed) || /^pragma/i.test(trimmed)) {
        const stmt = db.prepare(trimmed);
        const rows =
          binds.length > 0 ? stmt.all(...(binds as SQLInputValue[])) : stmt.all();
        return { toArray: () => rows as never };
      }
      if (binds.length === 0) {
        db.exec(trimmed);
        return { toArray: () => [] };
      }
      db.prepare(trimmed).run(...(binds as SQLInputValue[]));
      return { toArray: () => [] };
    },
  };
}

describe("sqlite-node session layout", () => {
  it("writes sessions/entries with official payload columns", async () => {
    const sql = wrapSqlite(new DatabaseSync(":memory:"));
    const store = sqliteSessionStore(sql, {
      id: "room-1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const session = new Session(new DurableSessionStorage(store));
    await session.getStorage().appendEntry({
      type: "message",
      id: "u1",
      parentId: null,
      timestamp: "2026-01-01T00:00:01.000Z",
      message: { role: "user", content: "hi", timestamp: Date.parse("2026-01-01T00:00:01.000Z") },
    });
    await session.appendCustomEntry("office.meta", { forId: "u1" });

    const tables = sql
      .exec(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      )
      .toArray() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        SQLITE_SESSIONS_TABLE,
        SQLITE_ENTRIES_TABLE,
        "scalar_values",
        "list_values",
        "usage_ledger",
        "branch_entries",
        "branch_meta",
      ]),
    );
    expect(tables.map((row) => row.name)).not.toContain("pi_session_entries");

    const sessionRow = sql
      .exec(
        `SELECT id, storage_version, next_seq, message_count FROM ${SQLITE_SESSIONS_TABLE}`,
      )
      .toArray() as Array<{
        id: string;
        storage_version: number;
        next_seq: number;
        message_count: number;
      }>;
    expect(sessionRow[0]).toMatchObject({
      id: "room-1",
      storage_version: 1,
      message_count: 1,
    });
    expect(sessionRow[0]?.next_seq).toBeGreaterThan(1);

    const rows = sql
      .exec(
        `SELECT id, parent_id, seq, type, custom_type, timestamp, payload
         FROM ${SQLITE_ENTRIES_TABLE} ORDER BY seq ASC`,
      )
      .toArray() as Array<{
        id: string;
        parent_id: string | null;
        seq: number;
        type: string;
        custom_type: string | null;
        timestamp: number;
        payload: string;
      }>;
    expect(rows[0]).toMatchObject({
      id: "u1",
      parent_id: null,
      seq: 1,
      type: "message",
      custom_type: null,
      timestamp: Date.parse("2026-01-01T00:00:01.000Z"),
    });
    const payload = JSON.parse(rows[0]?.payload ?? "{}") as Record<string, unknown>;
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("parentId");
    expect(payload).not.toHaveProperty("type");
    expect(payload).not.toHaveProperty("timestamp");
    expect(payload).toMatchObject({
      message: { role: "user", content: "hi" },
    });

    const custom = rows.find((row) => row.type === "custom");
    expect(custom?.custom_type).toBe("office.meta");
    expect(JSON.parse(custom?.payload ?? "{}")).toMatchObject({
      data: { forId: "u1" },
    });

    const reloaded = sqliteSessionStore(sql, {
      id: "ignored",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    const loaded = await reloaded.load();
    expect(loaded.metadata.id).toBe("room-1");
    expect(loaded.entries[0]).toMatchObject({
      id: "u1",
      type: "message",
      parentId: null,
      timestamp: "2026-01-01T00:00:01.000Z",
    });
  });

  it("migrates pi_session_entries blobs into official entries.payload", async () => {
    const db = new DatabaseSync(":memory:");
    const sql = wrapSqlite(db);
    db.exec(`CREATE TABLE pi_session_entries (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      type TEXT NOT NULL,
      entry TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE pi_session_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    db.prepare(
      `INSERT INTO pi_session_meta (key, value) VALUES (?, ?), (?, ?)`,
    ).run("id", "room-legacy", "createdAt", "2026-02-02T00:00:00.000Z");
    const entry = {
      type: "message",
      id: "u1",
      parentId: null,
      timestamp: "2026-02-02T00:00:01.000Z",
      message: { role: "user", content: "yo", timestamp: 1 },
    };
    db.prepare(
      `INSERT INTO pi_session_entries (id, parent_id, type, entry) VALUES (?, ?, ?, ?)`,
    ).run("u1", null, "message", JSON.stringify(entry));

    const loaded = await sqliteSessionStore(sql, {
      id: "fallback",
      createdAt: "2020-01-01T00:00:00.000Z",
    }).load();
    expect(loaded.metadata).toEqual({
      id: "room-legacy",
      createdAt: "2026-02-02T00:00:00.000Z",
    });
    expect(loaded.entries).toMatchObject([{ id: "u1", type: "message" }]);

    const leftover = sql
      .exec(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('pi_session_entries', 'pi_session_meta')`,
      )
      .toArray();
    expect(leftover).toEqual([]);
  });

  it("omits shared columns from payload the way sqlite-node does", () => {
    const payload = entryPayload({
      type: "custom",
      id: "c1",
      parentId: "u1",
      timestamp: "2026-01-01T00:00:00.000Z",
      customType: "office.meta",
      data: { forId: "u1" },
    });
    expect(payload).toEqual({ data: { forId: "u1" } });
    expect(
      decodeEntryRow({
        id: "c1",
        parent_id: "u1",
        seq: 2,
        type: "custom",
        custom_type: "office.meta",
        timestamp: Date.parse("2026-01-01T00:00:00.000Z"),
        payload: JSON.stringify(payload),
      }),
    ).toMatchObject({
      id: "c1",
      parentId: "u1",
      type: "custom",
      customType: "office.meta",
      data: { forId: "u1" },
    });
  });

  it("creates official tables on ensure", () => {
    const sql = wrapSqlite(new DatabaseSync(":memory:"));
    ensurePiSessionTables(sql);
    const columns = sql
      .exec(`PRAGMA table_info(entries)`)
      .toArray() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual([
      "session_id",
      "id",
      "parent_id",
      "seq",
      "type",
      "custom_type",
      "timestamp",
      "payload",
    ]);
  });
});
