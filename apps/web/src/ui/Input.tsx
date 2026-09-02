import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const controlClass =
  "w-full border border-line bg-card rounded-xl px-3 py-2.5 text-ink outline-none placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40";

type BaseInputProps = Omit<ComponentProps<typeof BaseInput>, "className">;

export function Input({
  className,
  ...props
}: BaseInputProps & { className?: string }) {
  return <BaseInput className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlClass, "resize-y min-h-[96px]", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("mb-3.5 grid gap-1.5", className)}>
      <span className="text-xs text-muted">{label}</span>
      {hint ? (
        <p className="m-0 text-xs leading-snug text-muted [&_a]:text-inherit">
          {hint}
        </p>
      ) : null}
      {children}
    </label>
  );
}
