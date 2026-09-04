import type { AvatarShape } from "@groxbot/contracts";
import type { RoomSeat } from "@groxbot/core/browser";

export type RoomMentionSeat = RoomSeat & {
  title?: string;
  avatarColor?: string;
  avatarShape?: AvatarShape;
};

export type RoomMentionDraft = {
  start: number;
  end: number;
  needle: string;
};

export const COMPOSER_INPUT_SELECTOR = "textarea.aui-composer-input";

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

export function readComposerCaret(fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const el = document.querySelector<HTMLTextAreaElement>(COMPOSER_INPUT_SELECTOR);
  if (!el) return fallback;
  return el.selectionStart ?? fallback;
}

export function placeComposerCaret(caret: number) {
  const el = document.querySelector<HTMLTextAreaElement>(COMPOSER_INPUT_SELECTOR);
  if (!el) return;
  el.focus();
  el.setSelectionRange(caret, caret);
}
