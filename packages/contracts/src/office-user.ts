import { isOfficeReviewUserMessage } from "./office-review.js";

/** Who sent an office Think message. Lives on UIMessage.metadata.user. */

export type OfficeUserMeta = {
  userId: string;
  name: string;
  image?: string;
};

/** Worker stamps these on the /agents/ handshake after requireActor. */
export const OFFICE_USER_ID_HEADER = "x-groxbot-user-id";
export const OFFICE_USER_NAME_HEADER = "x-groxbot-user-name";
export const OFFICE_USER_IMAGE_HEADER = "x-groxbot-user-image";

const MAX_NAME = 80;
const MAX_IMAGE = 2048;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanName(value: string): string {
  return value.trim().slice(0, MAX_NAME);
}

function cleanImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  if (url.length < 8 || url.length > MAX_IMAGE) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url;
}

function sameOfficeUser(
  a: OfficeUserMeta | null,
  b: OfficeUserMeta,
): boolean {
  return (
    a?.userId === b.userId &&
    a?.name === b.name &&
    (a?.image ?? "") === (b.image ?? "")
  );
}

export function officeUserFromActor(actor: {
  userId: string;
  name: string;
  email?: string;
  image?: string | null;
}): OfficeUserMeta | null {
  const userId = actor.userId.trim();
  if (!userId) return null;
  const name =
    cleanName(actor.name) ||
    cleanName(actor.email?.split("@")[0] ?? "") ||
    "Someone";
  const image = cleanImage(actor.image);
  return image ? { userId, name, image } : { userId, name };
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
  const image = cleanImage(row.image);
  return image ? { userId, name, image } : { userId, name };
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
    image: decodeHeader(headers.get(OFFICE_USER_IMAGE_HEADER)) || null,
  });
}

export function withOfficeUserRequest(
  request: Request,
  user: OfficeUserMeta,
): Request {
  const headers = new Headers(request.headers);
  headers.set(OFFICE_USER_ID_HEADER, encodeURIComponent(user.userId));
  headers.set(OFFICE_USER_NAME_HEADER, encodeURIComponent(user.name));
  if (user.image) {
    headers.set(OFFICE_USER_IMAGE_HEADER, encodeURIComponent(user.image));
  } else {
    headers.delete(OFFICE_USER_IMAGE_HEADER);
  }
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
    sameOfficeUser(current, user) &&
    sameOfficeUser(parseOfficeUser(custom), user)
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
 * Office-review triggers are not a human — leave them unlabeled.
 */
export function stampIncomingOfficeUser<
  T extends { role?: string; metadata?: unknown },
>(
  message: T,
  connected: OfficeUserMeta | null,
  existing: { metadata?: unknown } | null | undefined,
): T {
  if (isOfficeReviewUserMessage(message)) return message;
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
