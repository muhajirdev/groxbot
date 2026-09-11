/** SQLite / D1 unique constraint, plus leftover Postgres 23505 from dumps. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 6 && current; i++) {
    if (typeof current === "object" && current !== null) {
      const code =
        "code" in current ? String((current as { code: unknown }).code) : "";
      const message =
        "message" in current
          ? String((current as { message: unknown }).message)
          : "";
      const constraint =
        "constraint_name" in current
          ? String((current as { constraint_name: unknown }).constraint_name)
          : "";
      if (
        code === "23505" ||
        code === "SQLITE_CONSTRAINT_UNIQUE" ||
        code === "SQLITE_CONSTRAINT" ||
        code === "19" ||
        /UNIQUE constraint failed/i.test(message) ||
        constraint === "events_thread_seq" ||
        constraint === "messages_thread_seq"
      ) {
        return true;
      }
      current = "cause" in current ? (current as { cause: unknown }).cause : null;
    } else {
      current = null;
    }
  }
  return false;
}
