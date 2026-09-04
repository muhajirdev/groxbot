import { Menu } from "@base-ui/react/menu";
import { parseRoutineClock } from "@groxbot/core/browser";
import { useMemo, useState } from "react";
import {
  DEFAULT_ROUTINE_CLOCK,
  formatRoutineClock,
  formatRoutineScheduleLabel,
  formatRoutineTimezone,
  kindFromRoutineSchedule,
  ROUTINE_INTERVALS,
  ROUTINE_WEEKDAYS,
  composeRoutineSchedule,
  routineClockOptions,
  type RoutineScheduleKind,
} from "../lib/routine-schedule";
import { cn, Field, Input } from "../ui";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
);

const popupClass =
  "popover-popup max-h-[min(320px,var(--available-height))] min-w-[168px] overflow-auto rounded-[10px] border border-line bg-card p-1 outline-none";

export function RoutineScheduleField(props: {
  cron: string;
  timezone: string;
  onChange: (cron: string) => void;
}) {
  const kind = kindFromRoutineSchedule(props.cron);
  const time = clockFromSchedule(props.cron);
  const weekday = weekdayFromSchedule(props.cron);
  const clocks = useMemo(() => routineClockOptions(), []);
  const wallClock = kind !== "hour" && kind !== "interval";

  const pick = (next: {
    kind: RoutineScheduleKind;
    time?: string;
    weekday?: string;
    interval?: string;
    advanced?: string;
  }) => {
    props.onChange(
      composeRoutineSchedule({
        kind: next.kind,
        time: next.time ?? time,
        weekday: next.weekday ?? weekday,
        interval: next.interval ?? props.cron,
        advanced: next.advanced ?? props.cron,
      }),
    );
  };

  return (
    <div className="grid gap-3">
      <Field label="When to run" className="mb-0">
        <Menu.Root modal={false}>
          <Menu.Trigger
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2 text-left text-[14px] text-ink outline-none",
              "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40",
              "data-popup-open:border-accent",
            )}
          >
            <span className="min-w-0 truncate">
              {formatRoutineScheduleLabel(props.cron) || "Choose a time"}
            </span>
            <ChevronDownIcon className="size-3.5 text-muted" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner
              className="z-50 outline-none"
              side="bottom"
              align="start"
              sideOffset={4}
            >
              <Menu.Popup className={popupClass}>
                <Menu.Item
                  className={itemClass}
                  onClick={() => pick({ kind: "hour" })}
                >
                  Every hour
                  {kind === "hour" ? <CheckIcon className="size-3.5 text-muted" /> : null}
                </Menu.Item>
                <TimeSubmenu
                  label="Every day"
                  selected={kind === "day"}
                  time={time}
                  clocks={clocks}
                  onPick={(next) => pick({ kind: "day", time: next })}
                />
                <TimeSubmenu
                  label="Weekdays"
                  selected={kind === "weekday"}
                  time={time}
                  clocks={clocks}
                  onPick={(next) => pick({ kind: "weekday", time: next })}
                />
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={itemClass}>
                    Every week
                    <ChevronRightIcon className="size-3 text-muted" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className="z-50 outline-none" sideOffset={4}>
                      <Menu.Popup className={popupClass}>
                        {ROUTINE_WEEKDAYS.map((day) => (
                          <TimeSubmenu
                            key={day}
                            label={capitalize(day)}
                            selected={kind === "week" && weekday === day}
                            time={time}
                            clocks={clocks}
                            onPick={(next) =>
                              pick({ kind: "week", weekday: day, time: next })
                            }
                          />
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className={itemClass}>
                    Interval
                    <ChevronRightIcon className="size-3 text-muted" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className="z-50 outline-none" sideOffset={4}>
                      <Menu.Popup className={popupClass}>
                        {ROUTINE_INTERVALS.map((interval) => (
                          <Menu.Item
                            key={interval}
                            className={itemClass}
                            onClick={() =>
                              pick({
                                kind: interval === "every 1 hour" ? "hour" : "interval",
                                interval,
                              })
                            }
                          >
                            {formatRoutineScheduleLabel(interval)}
                            {props.cron === interval ? (
                              <CheckIcon className="size-3.5 text-muted" />
                            ) : null}
                          </Menu.Item>
                        ))}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.Item
                  className={itemClass}
                  onClick={() =>
                    pick({
                      kind: "advanced",
                      advanced: props.cron || "every day at 09:00",
                    })
                  }
                >
                  Advanced…
                  {kind === "advanced" ? (
                    <CheckIcon className="size-3.5 text-muted" />
                  ) : null}
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Field>
      {kind === "advanced" ? (
        <Field label="Schedule" className="mb-0">
          <Input
            value={props.cron}
            placeholder="every day at 9:00 AM"
            onValueChange={props.onChange}
          />
        </Field>
      ) : null}
      {wallClock ? (
        <p className="m-0 text-xs leading-snug text-muted">
          Configured to run in {formatRoutineTimezone(props.timezone)}. Change
          the zone in Settings.
        </p>
      ) : null}
    </div>
  );
}

function TimeSubmenu(props: {
  label: string;
  selected: boolean;
  time: string;
  clocks: string[];
  onPick: (time: string) => void;
}) {
  const [custom, setCustom] = useState("");
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger className={itemClass}>
        <span>{props.label}</span>
        <ChevronRightIcon className="size-3 text-muted" />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={4}>
          <Menu.Popup className={popupClass}>
            <div className="px-1 pb-1">
              <input
                className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:border-accent"
                placeholder="9:07 AM"
                value={custom}
                aria-label={`Custom time for ${props.label}`}
                onChange={(event) => setCustom(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key !== "Enter") return;
                  const next = parseRoutineClock(event.currentTarget.value);
                  if (next) props.onPick(next);
                }}
              />
            </div>
            {props.clocks.map((clock) => (
              <Menu.Item
                key={clock}
                className={itemClass}
                onClick={() => props.onPick(clock)}
              >
                {formatRoutineClock(clock)}
                {props.selected && props.time === clock ? (
                  <CheckIcon className="size-3.5 text-muted" />
                ) : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

function clockFromSchedule(cron: string): string {
  const match = /(\d{2}:\d{2})$/.exec(cron);
  return match?.[1] ?? DEFAULT_ROUTINE_CLOCK;
}

function weekdayFromSchedule(cron: string): string {
  const match = /^every week on ([a-z]+)/.exec(cron);
  return match?.[1] ?? "monday";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
