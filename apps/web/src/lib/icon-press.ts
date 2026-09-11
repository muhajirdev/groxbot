import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

const CLICK_MS = 460;
/** Icon-rail sidebar: dock labels and the You name are hidden. */
export const DOCK_LABELS_HIDE = "(max-width: 960px) and (min-width: 721px)";

/** One-shot `data-clicked` so icon click motion can finish after pointer-up. */
export function useIconPress() {
  const [clicked, setClicked] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pulse = useCallback(() => {
    setClicked(false);
    requestAnimationFrame(() => {
      setClicked(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setClicked(false), CLICK_MS);
    });
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      pulse();
    },
    [pulse],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      pulse();
    },
    [pulse],
  );

  return {
    "data-clicked": clicked ? true : undefined,
    onPointerDown,
    onKeyDown,
  } as const;
}

/** Desktop resize rail — same captions-off chrome as the tablet 72px sidebar. */
export const DockLabelsHiddenContext = createContext(false);

/** True when the 72px rail hides dock captions. */
export function useDockLabelsHidden() {
  const rail = useContext(DockLabelsHiddenContext);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DOCK_LABELS_HIDE);
    const sync = () => setHidden(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return hidden || rail;
}
