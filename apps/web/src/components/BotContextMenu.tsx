import type { Bot } from "@groxbot/contracts";
import { Menu } from "@base-ui/react/menu";
import { useMemo, useRef } from "react";
import {
  type BotMenuPhase,
  botMenuItems,
  isPinnedBot,
} from "../lib/sidebar";
import { cn } from "../ui";
import { PinIcon, TrashIcon } from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

type BotMenuState = {
  bot: Bot;
  x: number;
  y: number;
  phase: BotMenuPhase;
};

export function BotContextMenu(props: {
  menu: BotMenuState | null;
  sections: { id: string; name: string }[];
  onClose: () => void;
  onPin: (bot: Bot) => void;
  onMove: (bot: Bot, sectionId: string | null) => void;
  onPhase: (next: BotMenuState) => void;
  onDelete: (botId: string) => void;
}) {
  const last = useRef(props.menu);
  if (props.menu) last.current = props.menu;
  const current = props.menu ?? last.current;
  const anchor = useMemo(() => {
    if (!current) return null;
    const { x, y } = current;
    return {
      getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
    };
  }, [current]);

  if (!current) return null;

  const items = botMenuItems({
    pinned: isPinnedBot(current.bot),
    name: current.bot.name,
    phase: current.phase,
    sections: props.sections,
  });

  return (
    <Menu.Root
      modal={false}
      open={Boolean(props.menu)}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <Menu.Popup className="popover-popup min-w-[168px] rounded-[10px] border border-line bg-card p-1 outline-none">
            {items.map((item, index) => (
              <div
                key={
                  item.id === "move-to"
                    ? `move-${item.sectionId ?? "none"}`
                    : item.id
                }
              >
                {item.id === "delete" &&
                current.phase === "actions" &&
                index > 0 ? (
                  <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                ) : null}
                <Menu.Item
                  className={cn(itemClass, item.id === "delete" && "text-danger")}
                  closeOnClick={
                    item.id === "pin" ||
                    item.id === "move-to" ||
                    (item.id === "delete" && current.phase === "confirm-delete")
                  }
                  onClick={() => {
                    if (item.id === "pin") {
                      props.onPin(current.bot);
                      return;
                    }
                    if (item.id === "move") {
                      props.onPhase({ ...current, phase: "move" });
                      return;
                    }
                    if (item.id === "move-to") {
                      props.onMove(current.bot, item.sectionId);
                      return;
                    }
                    if (item.id === "cancel-delete") {
                      props.onPhase({ ...current, phase: "actions" });
                      return;
                    }
                    if (current.phase === "actions") {
                      props.onPhase({ ...current, phase: "confirm-delete" });
                      return;
                    }
                    props.onClose();
                    props.onDelete(current.bot.id);
                  }}
                >
                  {item.id === "pin" ? (
                    <PinIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "delete" ? (
                    <TrashIcon className="size-3.5 shrink-0" />
                  ) : null}
                  <span className="min-w-0 truncate">{item.label}</span>
                </Menu.Item>
              </div>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
