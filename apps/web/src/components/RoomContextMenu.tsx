import type { Room } from "@groxbot/contracts";
import { Menu } from "@base-ui/react/menu";
import { useMemo, useRef } from "react";
import { type RoomMenuPhase, roomMenuItems } from "../lib/sidebar";
import { Button, cn, ModalShell } from "../ui";
import { TrashIcon } from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

type RoomMenuState = {
  room: Room;
  x: number;
  y: number;
  phase: RoomMenuPhase;
};

export function RoomContextMenu(props: {
  menu: RoomMenuState | null;
  onClose: () => void;
  onPhase: (next: RoomMenuState) => void;
  onDelete: (room: Room) => void;
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

  const items = roomMenuItems({
    name: current.room.name,
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
            {items.map((item) => (
              <Menu.Item
                key={item.id}
                className={cn(itemClass, item.id === "delete" && "text-danger")}
                closeOnClick={
                  item.id === "delete" && current.phase === "confirm-delete"
                }
                onClick={() => {
                  if (item.id === "cancel-delete") {
                    props.onPhase({ ...current, phase: "actions" });
                    return;
                  }
                  if (current.phase === "actions") {
                    props.onPhase({ ...current, phase: "confirm-delete" });
                    return;
                  }
                  props.onClose();
                  props.onDelete(current.room);
                }}
              >
                {item.id === "delete" ? (
                  <TrashIcon className="size-3.5 shrink-0" />
                ) : null}
                <span className="min-w-0 truncate">{item.label}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function ConfirmRoomDeleteDialog(props: {
  room: Room | null;
  onClose: () => void;
  onConfirm: (room: Room) => void;
}) {
  const room = props.room;
  return (
    <ModalShell
      open={Boolean(room)}
      className="w-[min(340px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <div className="grid gap-3">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">
          Delete {room?.name ?? "room"}?
        </h2>
        <p className="m-0 text-[13px] text-muted">
          This removes the group thread. Teammates and their own rooms stay.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            className="px-3 py-1.5 text-[13px]"
            variant="ghost"
            type="button"
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            className="border-0 bg-danger px-3 py-1.5 text-[13px] text-white"
            type="button"
            onClick={() => {
              if (!room) return;
              props.onConfirm(room);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
