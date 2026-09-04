/** Browser-safe seat matching. Do not import `rooms.ts` from the SPA. */

export class RoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomError";
  }
}

export type RoomSeat = {
  id: string;
  name: string;
  homeRoomId?: string;
  title?: string;
  archivedAt?: Date | string | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Prefer a seated full name (`@Alexander the Great`), then the first @token. */
export function mentionFromText(
  text: string,
  names: readonly string[] = [],
): string | null {
  const seated = [...names]
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const name of seated) {
    const pattern = new RegExp(
      `(^|\\s)@${escapeRegExp(name)}(?=$|[\\s,!?:;.])`,
      "iu",
    );
    if (pattern.test(text)) return name;
  }
  const match = text.match(/(?:^|\s)@([A-Za-z0-9._-]+)/u);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

function matchLiveSeat(
  live: readonly RoomSeat[],
  needle: string,
): RoomSeat | undefined {
  const lowered = needle.replace(/^@/u, "").trim().toLowerCase();
  if (!lowered) return undefined;
  const byId = live.find((row) => row.id === needle);
  if (byId) return byId;
  const exact = live.find((row) => row.name.toLowerCase() === lowered);
  if (exact) return exact;
  const firstWord = live.filter(
    (row) => row.name.toLowerCase().split(/\s+/u)[0] === lowered,
  );
  if (firstWord.length === 1) return firstWord[0];
  if (firstWord.length > 1) {
    throw new RoomError(
      `${needle} matches more than one person. Use the full name.`,
    );
  }
  return undefined;
}

export function resolveRoomTargets(
  members: readonly RoomSeat[],
  target?: { targetBotId?: string | null; mention?: string | null },
): RoomSeat[] {
  const live = members.filter((row) => !row.archivedAt);
  if (live.length === 0) {
    throw new RoomError("This room has no teammates.");
  }
  const mention = (target?.mention ?? "").trim();
  const focused = (target?.targetBotId ?? "").trim();
  const needle = mention || focused;
  if (!needle) return live;
  const match = matchLiveSeat(live, needle);
  if (!match) {
    const lowered = needle.replace(/^@/u, "").toLowerCase();
    const archived = members.find((row) => {
      if (!row.archivedAt) return false;
      return (
        row.id === needle ||
        row.name.toLowerCase() === lowered ||
        row.name.toLowerCase().split(/\s+/u)[0] === lowered
      );
    });
    if (archived) throw new RoomError(`${archived.name} is archived.`);
    const names = live.map((row) => row.name).join(", ");
    throw new RoomError(
      `${needle} is not in this room.${names ? ` Seated: ${names}.` : ""}`,
    );
  }
  return [match];
}

export function resolveRoomTarget(
  members: readonly RoomSeat[],
  target?: { targetBotId?: string | null; mention?: string | null },
): RoomSeat {
  const [first] = resolveRoomTargets(members, target);
  if (!first) throw new RoomError("This room has no teammates.");
  return first;
}

export function firstLiveSeatName(
  members: readonly RoomSeat[],
  target?: { targetBotId?: string | null; mention?: string | null },
): string {
  try {
    return resolveRoomTarget(members, target).name;
  } catch {
    return members.find((row) => !row.archivedAt)?.name ?? "";
  }
}
