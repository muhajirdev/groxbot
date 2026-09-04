import { Menu } from "@base-ui/react/menu";
import { cn } from "../ui";
import { PlusIcon } from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

export function SidebarCreateMenu(props: {
  disabled?: boolean;
  active?: boolean;
  onNewBot: () => void;
  onNewRoom: () => void;
  onNewSection: () => void;
}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        disabled={props.disabled}
        aria-label="New"
        aria-busy={props.disabled}
        className={cn(
          "no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none",
          "transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)]",
          "hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent",
          "data-popup-open:bg-selected data-popup-open:text-ink",
          "disabled:cursor-not-allowed disabled:opacity-50",
          props.active && "bg-selected text-ink",
        )}
      >
        <PlusIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={6}
          align="end"
        >
          <Menu.Popup className="popover-popup min-w-[168px] rounded-[10px] border border-line bg-card p-1 outline-none">
            <Menu.Item
              className={itemClass}
              disabled={props.disabled}
              onClick={props.onNewBot}
            >
              New bot
            </Menu.Item>
            <Menu.Item className={itemClass} onClick={props.onNewRoom}>
              New room
            </Menu.Item>
            <Menu.Item className={itemClass} onClick={props.onNewSection}>
              New section
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
