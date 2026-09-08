import type { Room } from "@groxbot/contracts";
import {
  BOARD_VIEW_LABEL,
  BOARD_VIEWS,
  type BoardView,
  groupRoomsByWorkStatus,
  parseRoomWorkStatus,
  ROOM_WORK_STATUS_LABEL,
  ROOM_WORK_STATUSES,
  type RoomWorkStatus,
  roomSidebarFaces,
} from "@groxbot/core/browser";
import { Menu } from "@base-ui/react/menu";
import { Link } from "@tanstack/react-router";
import { type DragEvent, type MouseEvent, useMemo, useState } from "react";
import { readBoardView, writeBoardView } from "../lib/board-view";
import { ROOM_TO } from "../lib/office-route";
import { deskAwayFromLibrary, type OfficeSearch } from "../lib/office-search";
import { formatListTime } from "../lib/time";
import { Button, cn } from "../ui";
import { AvatarMark, PresenceDot } from "./Avatar";
import {
  BoardIcon,
  CheckIcon,
  ChevronDownIcon,
  ListIcon,
  MoreIcon,
  PlusIcon,
} from "./Icons";

const ROOM_DRAG = "application/x-groxbot-room";

const menuItemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
);

export function RoomBoard(props: {
  rooms: Room[];
  workspaceSlug: string;
  desk: OfficeSearch;
  workingIds: Set<string>;
  onStatus: (room: Room, status: RoomWorkStatus) => void;
  onMenu: (event: MouseEvent, room: Room) => void;
  onPick?: () => void;
  onNewRoom: (status?: RoomWorkStatus) => void;
}) {
  const grouped = useMemo(
    () => groupRoomsByWorkStatus(props.rooms),
    [props.rooms],
  );
  const [view, setView] = useState(readBoardView);
  const [dropStatus, setDropStatus] = useState<RoomWorkStatus | null>(null);

  function setBoardView(next: BoardView) {
    setView(next);
    writeBoardView(next);
  }

  function readDragId(event: DragEvent): string {
    return (
      event.dataTransfer.getData(ROOM_DRAG) ||
      event.dataTransfer.getData("text/plain")
    ).trim();
  }

  function dropOn(status: RoomWorkStatus, event: DragEvent) {
    event.preventDefault();
    setDropStatus(null);
    const id = readDragId(event);
    const room = props.rooms.find((row) => row.id === id);
    if (!room) return;
    if (parseRoomWorkStatus(room.status) === status) return;
    props.onStatus(room, status);
  }

  function dragStart(item: Room, event: DragEvent) {
    event.dataTransfer.setData(ROOM_DRAG, item.id);
    event.dataTransfer.setData("text/plain", item.id);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="room-board-wrap">
      <div className="room-board-toolbar">
        <DisplayMenu view={view} onView={setBoardView} />
      </div>
      {view === "list" ? (
        props.rooms.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
            <p className="m-0 text-[15px] font-semibold tracking-tight text-ink">
              No tasks yet
            </p>
            <p className="m-0 max-w-[36ch] text-center text-[13px] text-muted">
              Title is enough. Assign teammates when someone should work it.
            </p>
            <Button type="button" onClick={() => props.onNewRoom()}>
              New task
            </Button>
          </div>
        ) : (
          <div className="room-board-list">
            {ROOM_WORK_STATUSES.map((status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <section
                  key={status}
                  className="room-board-list-group"
                  aria-label={ROOM_WORK_STATUS_LABEL[status]}
                >
                  <header className="room-board-col-head">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="room-board-status"
                        data-status={status}
                      />
                      <span>{ROOM_WORK_STATUS_LABEL[status]}</span>
                      <span className="text-muted">{items.length}</span>
                    </span>
                  </header>
                  <div className="room-board-list-rows">
                    {items.map((item) => (
                      <ListRow
                        key={item.id}
                        item={item}
                        workspaceSlug={props.workspaceSlug}
                        desk={props.desk}
                        working={props.workingIds.has(item.id)}
                        onMenu={props.onMenu}
                        onPick={props.onPick}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="room-board">
          {ROOM_WORK_STATUSES.map((status) => (
            <section
              key={status}
              className={cn(
                "room-board-col",
                dropStatus === status && "is-drop",
              )}
              aria-label={ROOM_WORK_STATUS_LABEL[status]}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropStatus !== status) setDropStatus(status);
              }}
              onDragLeave={() => {
                if (dropStatus === status) setDropStatus(null);
              }}
              onDrop={(event) => dropOn(status, event)}
            >
              <header className="room-board-col-head">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="room-board-status" data-status={status} />
                  <span>{ROOM_WORK_STATUS_LABEL[status]}</span>
                  <span className="text-muted">{grouped[status].length}</span>
                </span>
                <button
                  className="room-board-col-add"
                  type="button"
                  aria-label={`New task in ${ROOM_WORK_STATUS_LABEL[status]}`}
                  onClick={() => props.onNewRoom(status)}
                >
                  <PlusIcon />
                </button>
              </header>
              <div className="room-board-cards">
                {grouped[status].length === 0 ? (
                  <p className="room-board-empty">No tasks</p>
                ) : (
                  grouped[status].map((item) => (
                    <BoardCard
                      key={item.id}
                      item={item}
                      workspaceSlug={props.workspaceSlug}
                      desk={props.desk}
                      working={props.workingIds.has(item.id)}
                      onMenu={props.onMenu}
                      onPick={props.onPick}
                      onDragStart={(event) => dragStart(item, event)}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DisplayMenu(props: {
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  const Icon = props.view === "list" ? ListIcon : BoardIcon;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="room-board-display"
        type="button"
        aria-label="Display"
      >
        <Icon />
        <span>{BOARD_VIEW_LABEL[props.view]}</span>
        <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={6}
          align="end"
        >
          <Menu.Popup className="popover-popup min-w-[168px] rounded-[10px] border border-line bg-card p-1 outline-none">
            {BOARD_VIEWS.map((id) => {
              const ItemIcon = id === "list" ? ListIcon : BoardIcon;
              return (
                <Menu.Item
                  key={id}
                  className={menuItemClass}
                  onClick={() => props.onView(id)}
                >
                  <ItemIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {BOARD_VIEW_LABEL[id]}
                  </span>
                  {props.view === id ? (
                    <CheckIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function BoardCard(props: {
  item: Room;
  workspaceSlug: string;
  desk: OfficeSearch;
  working?: boolean;
  onMenu: (event: MouseEvent, room: Room) => void;
  onPick?: () => void;
  onDragStart: (event: DragEvent) => void;
}) {
  const item = props.item;
  const faces = roomSidebarFaces(item.members);
  const preview = (item.description ?? "").trim() || item.lastPreview.trim();
  return (
    <div className="room-board-card-wrap group/board-card relative">
      <Link
        to={ROOM_TO}
        params={{
          workspaceSlug: props.workspaceSlug,
          roomId: item.id,
        }}
        search={deskAwayFromLibrary(props.desk)}
        draggable
        onDragStart={props.onDragStart}
        onClick={props.onPick}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onMenu(event, item);
        }}
        aria-label={props.working ? `${item.name}, working` : item.name}
        className="room-board-card"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold">
            {item.name}
          </span>
          <span className="shrink-0 text-xs whitespace-nowrap text-muted group-hover/board-card:invisible">
            {formatListTime(item.lastAt)}
          </span>
        </span>
        {preview ? (
          <span className="line-clamp-2 text-[12px] text-muted">{preview}</span>
        ) : null}
        {faces.length > 0 ? (
          <span className="room-board-card-faces">
            {faces.slice(0, 3).map((face, index) => (
              <span key={face.botId} className="relative inline-grid">
                <AvatarMark
                  name={face.name}
                  color={face.avatarColor}
                  shape={face.avatarShape}
                  size="xs"
                />
                {index === 0 ? (
                  <PresenceDot on={Boolean(props.working)} />
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
      <button
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted opacity-0 group-hover/board-card:opacity-100 hover:bg-hover hover:text-ink focus-visible:opacity-100 max-[720px]:opacity-100"
        type="button"
        aria-label={`${item.name} actions`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onMenu(event, item);
        }}
      >
        <MoreIcon />
      </button>
    </div>
  );
}

function ListRow(props: {
  item: Room;
  workspaceSlug: string;
  desk: OfficeSearch;
  working?: boolean;
  onMenu: (event: MouseEvent, room: Room) => void;
  onPick?: () => void;
}) {
  const item = props.item;
  const faces = roomSidebarFaces(item.members);
  const preview = (item.description ?? "").trim() || item.lastPreview.trim();
  return (
    <div className="room-board-list-row-wrap group/board-card relative">
      <Link
        to={ROOM_TO}
        params={{
          workspaceSlug: props.workspaceSlug,
          roomId: item.id,
        }}
        search={deskAwayFromLibrary(props.desk)}
        onClick={props.onPick}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onMenu(event, item);
        }}
        aria-label={props.working ? `${item.name}, working` : item.name}
        className="room-board-list-row"
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">
            {item.name}
          </span>
          {preview ? (
            <span className="mt-0.5 line-clamp-1 text-[12px] text-muted">
              {preview}
            </span>
          ) : null}
        </span>
        <span className="room-board-card-faces">
          {faces.slice(0, 3).map((face, index) => (
            <span key={face.botId} className="relative inline-grid">
              <AvatarMark
                name={face.name}
                color={face.avatarColor}
                shape={face.avatarShape}
                size="xs"
              />
              {index === 0 ? <PresenceDot on={Boolean(props.working)} /> : null}
            </span>
          ))}
        </span>
        <span className="shrink-0 text-xs whitespace-nowrap text-muted">
          {formatListTime(item.lastAt)}
        </span>
      </Link>
      <button
        className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent text-muted opacity-0 group-hover/board-card:opacity-100 hover:bg-hover hover:text-ink focus-visible:opacity-100 max-[720px]:opacity-100"
        type="button"
        aria-label={`${item.name} actions`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onMenu(event, item);
        }}
      >
        <MoreIcon />
      </button>
    </div>
  );
}
