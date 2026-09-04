import { Combobox } from "@base-ui/react/combobox";
import { useMemo } from "react";
import { AUTO_TIMEZONE } from "../lib/prefs";
import {
  defaultRoutineTimezone,
  formatRoutineTimezone,
  listRoutineTimezones,
} from "../lib/routine-schedule";
import { cn } from "../ui";
import { CheckIcon } from "./Icons";

export function TimezoneField(props: {
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
}) {
  const detected = useMemo(() => defaultRoutineTimezone(), []);
  const items = useMemo(
    () => [AUTO_TIMEZONE, ...listRoutineTimezones()],
    [],
  );
  const labelFor = (tz: string) =>
    tz === AUTO_TIMEZONE
      ? `Auto-detect (${formatRoutineTimezone(detected)})`
      : formatRoutineTimezone(tz);

  return (
    <Combobox.Root
      autoHighlight
      items={items}
      value={props.value}
      onValueChange={(value) => {
        if (typeof value === "string") props.onChange(value);
      }}
      itemToStringLabel={labelFor}
    >
      <Combobox.InputGroup
        className={cn(
          "flex w-full items-center rounded-lg border border-line bg-card px-3 py-2",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40",
        )}
      >
        <Combobox.Input
          aria-label={props["aria-label"] ?? "Timezone"}
          placeholder="Search timezones"
          className="w-full border-0 bg-transparent p-0 text-[14px] text-ink outline-none placeholder:text-muted"
        />
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={4}
          align="start"
        >
          <Combobox.Popup className="popover-popup max-h-[min(240px,var(--available-height))] w-[var(--anchor-width)] overflow-auto rounded-[10px] border border-line bg-card py-1 outline-none">
            <Combobox.Empty>
              <div className="px-3 py-2 text-[13px] text-muted">
                No timezones match.
              </div>
            </Combobox.Empty>
            <Combobox.List>
              {(tz: string) => (
                <Combobox.Item
                  key={tz}
                  value={tz}
                  className="flex cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-[13px] text-ink outline-none select-none data-highlighted:bg-hover"
                >
                  <span className="min-w-0 truncate">{labelFor(tz)}</span>
                  <Combobox.ItemIndicator className="text-muted">
                    <CheckIcon className="size-3.5" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
