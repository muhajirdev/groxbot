import { cn } from "../ui";

export function TypingDots(props: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "typing-dots mr-auto flex w-fit items-center gap-[5px] rounded-[18px] bg-[#141414] px-3 py-2.5 light:bg-[#ececec]",
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
