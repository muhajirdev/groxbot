import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema/index.js";
import type { Database as CatalogDatabase, DbHandles } from "./types.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle",
);

export const DEFAULT_SQLITE_PATH = "data/groxbot.sqlite";

export function createDb(filePath = ":memory:"): DbHandles {
  if (filePath !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  }
  const sqlite = new Database(filePath);
  sqlite.pragma("foreign_keys = ON");
  if (filePath !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  const db = drizzle(sqlite, { schema }) as unknown as CatalogDatabase;
  return {
    db,
    close: async () => {
      sqlite.close();
    },
  };
}

/** Apply generated Drizzle SQL onto a Node sqlite file or `:memory:`. */
export function createMigratedDb(filePath = ":memory:"): DbHandles {
  const handles = createDb(filePath);
  migrate(handles.db as Parameters<typeof migrate>[0], { migrationsFolder });
  return handles;
}

export function sqlitePathFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.DATABASE_PATH?.trim() || DEFAULT_SQLITE_PATH;
}
