import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { cn } from "@/lib/utils";
import { spiralFastData, spiralSlowData } from "./spiral-loader-data";

export type SpiralLoaderProps = ComponentProps<"span"> & {
  size?: number;
};

const FAST_REPEATS = 4;
const SLOW_REPEATS = 2;

/** Invert Lottie's white stroke when the app is in light theme. */
function useNeedsInvert() {
  const [invert, setInvert] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.theme !== "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setInvert(root.dataset.theme !== "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return invert;
}

/**
 * Agent Elements SpiralLoader — two-phase Lottie from
 * https://agent-elements.21st.dev/docs/spiral-loader
 * (lottie-react@2 API, same as their registry source).
 */
export function SpiralLoader({
  size = 16,
  className,
  ...props
}: SpiralLoaderProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"fast" | "slow">("fast");
  const repeats = useRef(0);
  const fastRef = useRef<LottieRefCurrentProps>(null);
  const slowRef = useRef<LottieRefCurrentProps>(null);
  const needsInvert = useNeedsInvert();

  useEffect(() => {
    setMounted(true);
  }, []);

  const startFast = useCallback(() => {
    repeats.current = 0;
    setPhase("fast");
    slowRef.current?.stop();
    fastRef.current?.goToAndPlay(0, true);
  }, []);

  const startSlow = useCallback(() => {
    repeats.current = 0;
    setPhase("slow");
    fastRef.current?.stop();
    slowRef.current?.goToAndPlay(0, true);
  }, []);

  const onFastComplete = useCallback(() => {
    repeats.current += 1;
    if (repeats.current < FAST_REPEATS) {
      fastRef.current?.goToAndPlay(0, true);
    } else {
      startSlow();
    }
  }, [startSlow]);

  const onSlowComplete = useCallback(() => {
    repeats.current += 1;
    if (repeats.current < SLOW_REPEATS) {
      slowRef.current?.goToAndPlay(0, true);
    } else {
      startFast();
    }
  }, [startFast]);

  if (!mounted) {
    return (
      <span
        aria-hidden
        className={cn("spiral-loader", className)}
        style={{ width: size, height: size }}
        {...props}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn("spiral-loader relative", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <span
        className={cn(
          "absolute inset-0 transition-opacity duration-75",
          needsInvert && "invert",
          phase === "fast" ? "opacity-100" : "opacity-0",
        )}
      >
        <Lottie
          lottieRef={fastRef}
          animationData={spiralFastData}
          loop={false}
          autoplay
          onComplete={onFastComplete}
          style={{ width: "100%", height: "100%" }}
        />
      </span>
      <span
        className={cn(
          "absolute inset-0 transition-opacity duration-75",
          needsInvert && "invert",
          phase === "slow" ? "opacity-100" : "opacity-0",
        )}
      >
        <Lottie
          lottieRef={slowRef}
          animationData={spiralSlowData}
          loop={false}
          autoplay={false}
          onComplete={onSlowComplete}
          style={{ width: "100%", height: "100%" }}
        />
      </span>
    </span>
  );
}

export function ThinkingStatus({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const who = name?.trim();
  const label = who ? `${who} is working` : "Working";
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "flex w-fit items-center gap-1.5 text-[12px] leading-none text-muted-foreground",
        className,
      )}
    >
      <SpiralLoader size={14} />
      <span className="shimmer motion-reduce:animate-none">{label}</span>
    </div>
  );
}
