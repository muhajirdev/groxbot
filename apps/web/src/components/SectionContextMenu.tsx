import type { SidebarSection } from "@groxbot/contracts";
import { Menu } from "@base-ui/react/menu";
import { useMemo, useRef } from "react";
import {
  type SectionMenuPhase,
  sectionMenuItems,
} from "../lib/sidebar";
import { cn } from "../ui";
import { TrashIcon } from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

type SectionMenuState = {
  section: SidebarSection;
  memberCount: number;
  x: number;
  y: number;
  phase: SectionMenuPhase;
};

export function SectionContextMenu(props: {
  menu: SectionMenuState | null;
  onClose: () => void;
  onRename: (section: SidebarSection) => void;
  onPhase: (next: SectionMenuState) => void;
  onDelete: (section: SidebarSection) => void;
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

  const items = sectionMenuItems({
    name: current.section.name,
    phase: current.phase,
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
              <div key={item.id}>
                {item.id === "delete" &&
                current.phase === "actions" &&
                index > 0 ? (
                  <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                ) : null}
                <Menu.Item
                  className={cn(itemClass, item.id === "delete" && "text-danger")}
                  closeOnClick={
                    item.id === "rename" ||
                    (item.id === "delete" &&
                      (current.phase === "confirm-delete" ||
                        current.memberCount === 0))
                  }
                  onClick={() => {
                    if (item.id === "rename") {
                      props.onRename(current.section);
                      return;
                    }
                    if (item.id === "cancel-delete") {
                      props.onPhase({ ...current, phase: "actions" });
                      return;
                    }
                    if (
                      current.phase === "actions" &&
                      current.memberCount > 0
                    ) {
                      props.onPhase({ ...current, phase: "confirm-delete" });
                      return;
                    }
                    props.onClose();
                    props.onDelete(current.section);
                  }}
                >
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
