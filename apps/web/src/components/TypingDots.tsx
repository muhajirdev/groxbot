import { cn } from "../ui";

export function TypingDots(props: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "typing-dots mr-auto flex w-fit items-center gap-[5px] rounded-[14px] bg-card px-3 py-1.5 light:bg-card-2",
        props.className,
      )}
      role="status"
      aria-label={props.label ?? "Loading"}
    >
      <i />
      <i />
      <i />
    </div>
  );
}
