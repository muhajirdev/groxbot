import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function PersonAvatar(props: {
  name: string;
  image?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const size = props.size ?? "sm";
  return (
    <Avatar
      size={size === "md" ? "default" : "sm"}
      aria-hidden
      className={cn(
        "after:border-white/10",
        size === "xs" && "size-4.5 after:hidden",
        size === "sm" && "size-7",
        size === "md" && "size-9 after:border-white/15",
        props.className,
      )}
    >
      {props.image ? (
        <AvatarImage
          src={props.image}
          alt=""
          referrerPolicy="no-referrer"
        />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-[#4d5568] font-semibold text-white",
          size === "xs" ? "text-[8px]" : "text-[11px]",
        )}
      >
        {personInitials(props.name)}
      </AvatarFallback>
    </Avatar>
  );
}
