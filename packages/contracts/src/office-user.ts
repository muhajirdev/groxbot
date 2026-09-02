/** Who sent an office Think message. Lives on UIMessage.metadata.user. */

export type OfficeUserMeta = {
  userId: string;
  name: string;
};

/** Worker stamps these on the /agents/ handshake after requireActor. */
export const OFFICE_USER_ID_HEADER = "x-groxbot-user-id";
export const OFFICE_USER_NAME_HEADER = "x-groxbot-user-name";

const MAX_NAME = 80;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanName(value: string): string {
  return value.trim().slice(0, MAX_NAME);
}

export function officeUserFromActor(actor: {
  userId: string;
  name: string;
  email?: string;
}): OfficeUserMeta | null {
  const userId = actor.userId.trim();
  if (!userId) return null;
  const name =
    cleanName(actor.name) ||
    cleanName(actor.email?.split("@")[0] ?? "") ||
    "Someone";
  return { userId, name };
}

/** Accepts `{ userId, name }` or `{ user: { userId, name } }`. */
export function parseOfficeUser(value: unknown): OfficeUserMeta | null {
  const row = asRecord(value);
  if (!row) return null;
  const nested = asRecord(row.user) ?? asRecord(row.custom);
  if (nested) {
    const fromNested = parseOfficeUser(nested);
    if (fromNested) return fromNested;
  }
  const userId = typeof row.userId === "string" ? row.userId.trim() : "";
  const name = typeof row.name === "string" ? cleanName(row.name) : "";
  if (!userId || !name) return null;
  return { userId, name };
}

export function parseOfficeUserMeta(metadata: unknown): OfficeUserMeta | null {
  return parseOfficeUser(metadata);
}

function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export function officeUserFromHeaders(
  headers: Headers,
): OfficeUserMeta | null {
  return officeUserFromActor({
    userId: decodeHeader(headers.get(OFFICE_USER_ID_HEADER)),
    name: decodeHeader(headers.get(OFFICE_USER_NAME_HEADER)),
  });
}

export function withOfficeUserRequest(
  request: Request,
  user: OfficeUserMeta,
): Request {
  const headers = new Headers(request.headers);
  headers.set(OFFICE_USER_ID_HEADER, encodeURIComponent(user.userId));
  headers.set(OFFICE_USER_NAME_HEADER, encodeURIComponent(user.name));
  return new Request(request, { headers });
}

export function stampOfficeUser<
  T extends { role?: string; metadata?: unknown },
>(message: T, user: OfficeUserMeta | null): T {
  if (!user || (message.role && message.role !== "user")) return message;
  const current = parseOfficeUserMeta(message.metadata);
  const previous = asRecord(message.metadata);
  const custom = asRecord(previous?.custom);
  if (
    current &&
    current.userId === user.userId &&
    current.name === user.name &&
    parseOfficeUser(custom)?.userId === user.userId
  ) {
    return message;
  }
  return {
    ...message,
    metadata: {
      ...previous,
      user,
      // assistant-ui ThreadMessage only keeps metadata.custom.
      custom: {
        ...custom,
        user,
      },
    },
  };
}

/**
 * Stamp identity at Think intake. New user rows get the connected human.
 * Existing rows keep the stored sender so a later turn cannot rewrite history.
 */
export function stampIncomingOfficeUser<
  T extends { role?: string; metadata?: unknown },
>(
  message: T,
  connected: OfficeUserMeta | null,
  existing: { metadata?: unknown } | null | undefined,
): T {
  if (existing) {
    const stored = parseOfficeUserMeta(existing.metadata);
    return stored ? stampOfficeUser(message, stored) : message;
  }
  return stampOfficeUser(message, connected);
}

/** Attach sender metadata to a useAgentChat / sendMessage payload. */
export function withOfficeUserMetadata(
  payload: unknown,
  user: OfficeUserMeta | null,
): unknown {
  if (!user || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const row = payload as Record<string, unknown>;
  const stamped = stampOfficeUser(
    { role: "user", metadata: row.metadata },
    user,
  );
  return { ...row, metadata: stamped.metadata };
}
