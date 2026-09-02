import { cn } from "@/lib/utils";
import type { ComponentProps, CSSProperties } from "react";

export type SpiralLoaderProps = ComponentProps<"span"> & {
  size?: number;
};

/**
 * Agent Elements spiral: one period of the ribbon crawls left.
 * Trim and shift stay locked to the path period so the loop doesn't hitch.
 */
export function SpiralLoader({
  size = 16,
  className,
  ...props
}: SpiralLoaderProps) {
  return (
    <span
      aria-hidden
      className={cn("spiral-loader", className)}
      style={
        {
          width: size,
          height: size,
          "--spiral-shift": `${size * 0.5}px`,
        } as CSSProperties
      }
      {...props}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <title>Loading</title>
        <path
          className="spiral-loader-path"
          pathLength={100}
          d="M0 14C4.452 14 6.736 10.284 7.025 6.988C7.255 4.361 6.218 2 4 2C1.782 2 .745 4.361 .975 6.988C1.264 10.284 3.548 14 8 14C12.452 14 14.736 10.284 15.025 6.988C15.255 4.361 14.218 2 12 2C9.782 2 8.745 4.361 8.975 6.988C9.264 10.284 11.548 14 16 14C20.452 14 22.736 10.284 23.025 6.988C23.255 4.361 22.218 2 20 2C17.782 2 16.748 4.361 16.98 6.988C17.272 10.284 19.557 14 24 14"
        />
      </svg>
    </span>
  );
}

export function ThinkingStatus({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Thinking"
      className={cn(
        "flex w-fit items-center gap-1.5 text-[12px] leading-none text-muted-foreground",
        className,
      )}
    >
      <SpiralLoader size={14} />
      <span className="shimmer motion-reduce:animate-none">Thinking</span>
    </div>
  );
}
