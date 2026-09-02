import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "./cn";

const variants = {
  solid:
    "border-0 bg-ink text-[var(--bg)] rounded-pill px-4 py-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:
    "bg-transparent text-ink border border-line rounded-pill px-4 py-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed",
  text: "border-0 bg-transparent text-muted px-0 py-2 text-[13px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
  icon: "grid size-8 place-items-center border-0 rounded-lg bg-transparent text-muted cursor-pointer outline-none hover:bg-hover data-[on]:bg-selected data-[on]:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed",
  mini: "inline-flex items-center gap-1.5 rounded-pill border border-line bg-card-2 px-3 py-1.5 text-[13px] text-ink cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent",
} as const;

type Variant = keyof typeof variants;

type BaseProps = Omit<ComponentProps<typeof BaseButton>, "className">;

export function Button({
  className,
  variant = "solid",
  size,
  on,
  ...props
}: BaseProps & {
  className?: string;
  variant?: Variant;
  size?: "tiny";
  on?: boolean;
}) {
  return (
    <BaseButton
      className={cn(
        variants[variant],
        size === "tiny" && "px-2.5 py-1.5 text-xs",
        className,
      )}
      data-on={on ? "" : undefined}
      {...props}
    />
  );
}
