import { Select as BaseSelect } from "@base-ui/react/select";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectGroup = {
  label: string;
  options: SelectOption[];
};

export function Select(props: {
  value: string;
  onValueChange: (value: string) => void;
  groups: SelectGroup[];
  "aria-label"?: string;
  className?: string;
  placeholder?: string;
}) {
  const items = props.groups.flatMap((group) =>
    group.options.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  );

  return (
    <BaseSelect.Root
      value={props.value}
      onValueChange={(value) => {
        if (typeof value === "string") props.onValueChange(value);
      }}
      items={items}
    >
      <BaseSelect.Trigger
        aria-label={props["aria-label"]}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2 text-left text-[14px] text-ink outline-none",
          props.className,
        )}
      >
        <BaseSelect.Value placeholder={props.placeholder} />
        <BaseSelect.Icon className="text-muted">
          <ChevronIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className="popover-popup max-h-[min(320px,50vh)] w-[var(--anchor-width)] overflow-auto rounded-xl border border-line bg-card py-1 outline-none">
            {props.groups.map((group) => (
              <BaseSelect.Group key={group.label}>
                <BaseSelect.GroupLabel className="px-3 py-1.5 text-xs text-muted">
                  {group.label}
                </BaseSelect.GroupLabel>
                {group.options.map((option) => (
                  <BaseSelect.Item
                    key={option.value}
                    value={option.value}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover data-[selected]:bg-selected"
                  >
                    <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.Group>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Chip(props: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  type?: "button";
  className?: string;
}) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border border-line bg-card px-3 py-2 text-[13px] text-ink cursor-pointer",
        props.selected && "border-ink bg-ink text-bg",
        props.className,
      )}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
