import type { AvatarShape } from "@groxbot/contracts";

export type RoomMentionSeat = {
  id: string;
  name: string;
  archivedAt: string | null;
  title?: string;
  avatarColor?: string;
  avatarShape?: AvatarShape;
};

export type RoomMentionDraft = {
  start: number;
  end: number;
  needle: string;
};

const MENTION_WORD = /^[A-Za-z0-9._-]*$/;

/** `@token` at the caret. Spaces close the picker so full names are inserted, not typed. */
export function mentionDraftAt(
  text: string,
  caret: number,
): RoomMentionDraft | null {
  const pos = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, pos);
  const match = /(^|[\s])@([A-Za-z0-9._-]*)$/.exec(before);
  if (!match) return null;
  const head = match[2] ?? "";
  const restMatch = /^([A-Za-z0-9._-]*)/.exec(text.slice(pos));
  const rest = restMatch?.[1] ?? "";
  if (rest && !MENTION_WORD.test(head + rest)) return null;
  const start = before.length - head.length - 1;
  return { start, end: pos + rest.length, needle: `${head}${rest}` };
}

export function matchRoomMentions(
  needle: string,
  seats: readonly RoomMentionSeat[],
): RoomMentionSeat[] {
  const live = seats.filter((row) => !row.archivedAt);
  const query = needle.trim().toLowerCase();
  if (!query) return live;
  return live.filter((row) => {
    const name = row.name.toLowerCase();
    const title = (row.title ?? "").toLowerCase();
    const first = name.split(/\s+/u)[0] ?? "";
    return (
      name.includes(query) ||
      first.startsWith(query) ||
      title.includes(query)
    );
  });
}

export function applyRoomMention(
  text: string,
  draft: RoomMentionDraft,
  name: string,
): { text: string; caret: number } {
  const insert = `@${name} `;
  const after = text.slice(draft.end).replace(/^\s+/u, "");
  const next = `${text.slice(0, draft.start)}${insert}${after}`;
  return { text: next, caret: draft.start + insert.length };
}

export function seatsFromRoomMembers(
  members: readonly {
    botId: string;
    name: string;
    title: string;
    avatarColor: string;
    avatarShape: AvatarShape;
    archivedAt: string | null;
  }[],
): RoomMentionSeat[] {
  return members.map((member) => ({
    id: member.botId,
    name: member.name,
    title: member.title,
    avatarColor: member.avatarColor,
    avatarShape: member.avatarShape,
    archivedAt: member.archivedAt,
  }));
}
