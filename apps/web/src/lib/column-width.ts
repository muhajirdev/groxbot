import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";

export const COLUMN_WIDTH_STEP = 8;

export type ColumnWidthConfig = {
  key: string;
  min: number;
  max: number;
  fallback: number;
  /** Handle on the left of the column: drag left to grow. */
  invert?: boolean;
};

export function clampColumnWidth(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function readColumnWidth(config: ColumnWidthConfig): number {
  try {
    const raw = localStorage.getItem(config.key);
    if (!raw) return config.fallback;
    return clampColumnWidth(
      Number(raw),
      config.min,
      config.max,
      config.fallback,
    );
  } catch {
    return config.fallback;
  }
}

export function writeColumnWidth(
  config: ColumnWidthConfig,
  value: number,
): void {
  localStorage.setItem(
    config.key,
    String(
      clampColumnWidth(value, config.min, config.max, config.fallback),
    ),
  );
}

export function useColumnWidth(config: ColumnWidthConfig) {
  const [width, setWidth] = useState(() => readColumnWidth(config));
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;
  const invert = Boolean(config.invert);

  const apply = useCallback(
    (next: number) => {
      const clamped = clampColumnWidth(
        next,
        config.min,
        config.max,
        config.fallback,
      );
      widthRef.current = clamped;
      setWidth(clamped);
      return clamped;
    },
    [config.fallback, config.max, config.min],
  );

  const persist = useCallback(
    (next: number) => {
      writeColumnWidth(config, apply(next));
    },
    [apply, config],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, w: widthRef.current };
      setResizing(true);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const start = drag.current;
      if (!start) return;
      const delta = event.clientX - start.x;
      apply(start.w + (invert ? -delta : delta));
    },
    [apply, invert],
  );

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setResizing(false);
    writeColumnWidth(config, widthRef.current);
  }, [config]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = event.shiftKey ? COLUMN_WIDTH_STEP * 3 : COLUMN_WIDTH_STEP;
      const grow = invert ? "ArrowLeft" : "ArrowRight";
      const shrink = invert ? "ArrowRight" : "ArrowLeft";
      if (event.key === grow) {
        event.preventDefault();
        persist(widthRef.current + step);
      } else if (event.key === shrink) {
        event.preventDefault();
        persist(widthRef.current - step);
      } else if (event.key === "Home") {
        event.preventDefault();
        persist(config.min);
      } else if (event.key === "End") {
        event.preventDefault();
        persist(config.max);
      }
    },
    [config.max, config.min, invert, persist],
  );

  const onDoubleClick = useCallback(() => {
    persist(config.fallback);
  }, [config.fallback, persist]);

  return {
    width,
    resizing,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onDoubleClick,
  };
}
