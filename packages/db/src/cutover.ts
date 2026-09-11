/** D1 bind-parameter cap (Paid). Keep insert batches under this. */
export const D1_MAX_BOUND_PARAMS = 100;

export function sqliteTimestamp(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

export function sqliteJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

export function sqliteBool(value: unknown): number | null {
  if (value == null) return null;
  if (value === true || value === 1 || value === "1" || value === "t") return 1;
  if (value === false || value === 0 || value === "0" || value === "f") return 0;
  return Boolean(value) ? 1 : 0;
}

/** Split rows so each INSERT stays under D1’s 100 bound-parameter limit. */
export function splitBindRows<T>(
  rows: T[],
  columnsPerRow: number,
  maxParams = D1_MAX_BOUND_PARAMS,
): T[][] {
  if (rows.length === 0) return [];
  const perChunk = Math.max(1, Math.floor(maxParams / Math.max(1, columnsPerRow)));
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += perChunk) {
    chunks.push(rows.slice(i, i + perChunk));
  }
  return chunks;
}

export type CutoverRow = Record<string, unknown>;

const TIMESTAMP_KEYS = new Set([
  "created_at",
  "updated_at",
  "expires_at",
  "archived_at",
  "pinned_at",
  "access_token_expires_at",
  "refresh_token_expires_at",
  "last_seen_at",
  "revoked_at",
  "lease_expires_at",
  "started_at",
  "completed_at",
  "current_period_end",
  "usage_period_start",
]);

const JSON_KEYS = new Set(["blocks", "payload"]);

const BOOL_KEYS = new Set([
  "email_verified",
  "online",
  "is_default",
  "on_demand_enabled",
]);

/** Coerce one Neon/JSON dump row to SQLite column values (snake_case keys). */
export function coerceCutoverRow(row: CutoverRow): CutoverRow {
  const out: CutoverRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (TIMESTAMP_KEYS.has(key)) {
      out[key] = sqliteTimestamp(value);
    } else if (JSON_KEYS.has(key)) {
      out[key] = sqliteJson(value);
    } else if (BOOL_KEYS.has(key)) {
      out[key] = sqliteBool(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
