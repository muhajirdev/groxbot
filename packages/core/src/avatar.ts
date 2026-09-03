import type { KnowledgeDisk } from "./knowledge.js";

export const AVATAR_KEY_PREFIX = "_avatars/";
export const AVATAR_PATH_PREFIX = "/avatars/";
export const MAX_AVATAR_BYTES = 256 * 1024;

const USER_ID_MAX = 80;

export function avatarObjectKey(userId: string): string {
  return `${AVATAR_KEY_PREFIX}${sanitizeAvatarUserId(userId)}`;
}

export function avatarPublicPath(userId: string): string {
  return `${AVATAR_PATH_PREFIX}${sanitizeAvatarUserId(userId)}`;
}

export function sanitizeAvatarUserId(raw: string): string {
  const id = raw.trim();
  if (
    !id ||
    id.length > USER_ID_MAX ||
    id.includes("/") ||
    id.includes("\\") ||
    id.includes("\0") ||
    id.includes("..")
  ) {
    throw new Error("Unknown person.");
  }
  return id;
}

export function sniffAvatarMediaType(
  bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function decodeAvatarPayload(content: string): Uint8Array {
  const trimmed = content.trim();
  const marker = "base64,";
  const at = trimmed.indexOf(marker);
  const b64 = (at >= 0 ? trimmed.slice(at + marker.length) : trimmed).replace(
    /\s/g,
    "",
  );
  if (!b64) throw new Error("That photo is empty.");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("That photo is too large.");
  }
  if (!sniffAvatarMediaType(bytes)) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }
  return bytes;
}

export function isStoredAvatarPath(image: string): boolean {
  return image.startsWith(AVATAR_PATH_PREFIX);
}

export function publishedProfileImage(
  image: string | null | undefined,
  userId: string,
  version: number,
  apiUrl: string,
): string | null {
  const value = image?.trim() ?? "";
  if (!value) return null;
  if (isStoredAvatarPath(value) || value.startsWith(AVATAR_KEY_PREFIX)) {
    const base = apiUrl.replace(/\/$/, "");
    return `${base}${avatarPublicPath(userId)}?v=${version}`;
  }
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

export async function readAvatar(
  disk: KnowledgeDisk,
  userId: string,
): Promise<{ bytes: Uint8Array; mediaType: string } | null> {
  const bytes = await disk.getBytes(avatarObjectKey(userId));
  if (!bytes) return null;
  const mediaType = sniffAvatarMediaType(bytes);
  if (!mediaType) return null;
  return { bytes, mediaType };
}

export async function writeAvatar(
  disk: KnowledgeDisk,
  userId: string,
  bytes: Uint8Array,
): Promise<string> {
  const mediaType = sniffAvatarMediaType(bytes);
  if (!mediaType) throw new Error("Use a JPEG, PNG, or WebP photo.");
  if (bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new Error("That photo is too large.");
  }
  await disk.put(avatarObjectKey(userId), bytes, mediaType);
  return avatarPublicPath(userId);
}

export async function removeAvatar(
  disk: KnowledgeDisk,
  userId: string,
): Promise<void> {
  await disk.delete(avatarObjectKey(userId));
}
