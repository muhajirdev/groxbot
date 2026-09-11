import { integer } from "drizzle-orm/sqlite-core";

/** Integer milliseconds; Drizzle maps to `Date`. */
export function timestampMs(name: string) {
  return integer(name, { mode: "timestamp_ms" });
}

export function timestampMsNow(name: string) {
  return integer(name, { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
}

export function bool(name: string, defaultValue = false) {
  return integer(name, { mode: "boolean" }).notNull().default(defaultValue);
}
