import type { Database } from "./types.js";

type Batchable = {
  batch?: (statements: unknown[]) => Promise<unknown> | unknown;
};

/**
 * D1 has no SQL BEGIN. Drizzle D1 `transaction()` emits BEGIN/COMMIT and fails.
 * Prefer `db.batch` when the driver has it (D1); otherwise run statements in order
 * (Node better-sqlite3).
 */
export async function runCatalogBatch(
  db: Database,
  statements: unknown[],
): Promise<void> {
  if (statements.length === 0) return;
  const batch = (db as Batchable).batch;
  if (typeof batch === "function") {
    await batch.call(db, statements);
    return;
  }
  for (const statement of statements) {
    await statement;
  }
}
