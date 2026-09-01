import { useEffect, useRef, useState } from "react";

/** Keep in sync with `--dur-pane` in styles.css. */
export const PANE_MOTION_MS = 280;

/** Hold the last pane while it exits so close can animate. */
export function usePanePresence<T extends string>(mode: T | null) {
  const [rendered, setRendered] = useState(mode);
  const [leaving, setLeaving] = useState(false);
  const shown = useRef(mode);
  shown.current = rendered;

  useEffect(() => {
    if (mode) {
      setRendered(mode);
      setLeaving(false);
      return;
    }
    if (!shown.current) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setRendered(null);
      setLeaving(false);
    }, PANE_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);

  return { rendered, leaving };
}
