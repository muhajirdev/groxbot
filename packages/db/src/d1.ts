import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index.js";
import type { Database, DbHandles } from "./types.js";

export type { Database, DbHandles } from "./types.js";

/** Hosted Worker / Durable Object catalog. Primary only (Sessions are follow-up). */
export function createD1Db(binding: Parameters<typeof drizzle>[0]): DbHandles {
  const db = drizzle(binding, { schema }) as unknown as Database;
  return {
    db,
    close: async () => {},
  };
}

export * from "./schema/index.js";
export { schema };
