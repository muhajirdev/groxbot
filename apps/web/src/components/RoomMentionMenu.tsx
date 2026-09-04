import { unstable_useComposerInput } from "@assistant-ui/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AvatarMark } from "./Avatar";
import {
  applyRoomMention,
  matchRoomMentions,
  mentionDraftAt,
  placeComposerCaret,
  readComposerCaret,
  type RoomMentionSeat,
} from "../lib/room-mention";
import { cn } from "../lib/utils";

const MAX_HITS = 8;

export function RoomMentionMenu(props: { seats: readonly RoomMentionSeat[] }) {
  const { value, setText } = unstable_useComposerInput();
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const listId = useId();
  const live = props.seats.filter((row) => !row.archivedAt);

  useLayoutEffect(() => {
    setCaret(readComposerCaret(value.length));
  }, [value]);

  const draft = live.length === 0 ? null : mentionDraftAt(value, caret);
  const draftKey = draft ? `${draft.start}:${draft.needle}` : "";
  const hits = draft
    ? matchRoomMentions(draft.needle, live).slice(0, MAX_HITS)
    : [];
  const open = Boolean(draft && hits.length > 0 && dismissed !== draftKey);

  useEffect(() => {
    setActive(0);
  }, [draftKey]);

  const pick = useCallback(
    (seat: RoomMentionSeat) => {
      if (!draft) return;
      const next = applyRoomMention(value, draft, seat.name);
      setText(next.text);
      requestAnimationFrame(() => placeComposerCaret(next.caret));
      setDismissed(null);
    },
    [draft, setText, value],
  );
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const hitsRef = useRef(hits);
  hitsRef.current = hits;
  const activeRef = useRef(active);
  activeRef.current = active;
  const openRef = useRef(open);
  openRef.current = open;
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;

  useEffect(() => {
    const isComposer = (event: Event) =>
      event.target instanceof HTMLTextAreaElement &&
      event.target.classList.contains("aui-composer-input");
    const syncCaret = (event: Event) => {
      if (!isComposer(event)) return;
      const el = event.target as HTMLTextAreaElement;
      setCaret(el.selectionStart ?? el.value.length);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isComposer(event) || !openRef.current) return;
      const rows = hitsRef.current;
      if (rows.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActive((index) => (index + 1) % rows.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActive((index) => (index - 1 + rows.length) % rows.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        const seat = rows[activeRef.current] ?? rows[0];
        if (seat) pickRef.current(seat);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setDismissed(draftKeyRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", syncCaret);
    document.addEventListener("click", syncCaret);
    document.addEventListener("select", syncCaret, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", syncCaret);
      document.removeEventListener("click", syncCaret);
      document.removeEventListener("select", syncCaret, true);
    };
  }, []);

  if (!open || !draft) return null;
  const selected = hits[active] ?? hits[0];

  return (
    <ul
      id={listId}
      className="skill-slash popover-popup popover-mount rounded-[10px] border border-line bg-card"
      role="listbox"
      aria-label="Mention a teammate"
    >
      {hits.map((seat) => {
        const on = seat.id === selected?.id;
        return (
          <li key={seat.id} role="none">
            <button
              id={`${listId}-${seat.id}`}
              className={cn("skill-slash-item mention-slash-item", on && "on")}
              type="button"
              role="option"
              aria-selected={on}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(seat)}
            >
              {seat.avatarColor && seat.avatarShape ? (
                <AvatarMark
                  name={seat.name}
                  color={seat.avatarColor}
                  shape={seat.avatarShape}
                  size="xs"
                />
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="skill-slash-name">@{seat.name}</span>
                {seat.title ? (
                  <span className="skill-slash-desc">{seat.title}</span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
