import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HERO_COMPARE_NAMES, HERO_LEDE } from "../lib/copy";

const SWAP_MS = 2200;

export function measureActiveWidth(
  track: { children: ArrayLike<{ scrollWidth: number }> },
  index: number,
) {
  return track.children[index]?.scrollWidth ?? 0;
}

export function HeroCompare() {
  const trackRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState<number | null>(null);
  const [reduce, setReduce] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || reduce) return;
    const next = measureActiveWidth(track, index);
    if (next > 0) setWidth(next);
  }, [index, reduce]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReduce(motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);

    const onResize = () => {
      const track = trackRef.current;
      if (!track || motion.matches) return;
      const next = measureActiveWidth(track, index);
      if (next > 0) setWidth(next);
    };
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(onResize);

    return () => {
      motion.removeEventListener("change", syncMotion);
      window.removeEventListener("resize", onResize);
    };
  }, [index]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_COMPARE_NAMES.length);
    }, SWAP_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <p className="lede hero-compare">
      <span className="hero-compare-line" aria-hidden="true">
        <span>Like</span>
        <span
          className="hero-swap"
          style={
            !reduce && width != null ? { width: `${width}px` } : undefined
          }
        >
          <span className="hero-swap-sizer">{HERO_COMPARE_NAMES[index]}</span>
          <span className="hero-swap-track" ref={trackRef}>
            {HERO_COMPARE_NAMES.map((name, nameIndex) => (
              <span
                key={name}
                className={nameIndex === index ? "on" : undefined}
              >
                {name}
              </span>
            ))}
          </span>
        </span>
        <span>but for teams.</span>
      </span>
      <span className="sr-only">{HERO_LEDE}</span>
    </p>
  );
}
