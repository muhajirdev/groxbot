import type { Bot, Room, WorkspaceApp } from "@groxbot/contracts";
import { Dialog } from "@base-ui/react/dialog";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import {
  paletteFilePrefetchPaths,
  paletteSearchKey,
  rankPaletteItems,
  type PaletteActionId,
  type PaletteFile,
  type PaletteItem,
  type PaletteRoom,
} from "../lib/command-palette";
import { prefetchKnowledgeFiles } from "../lib/file-cache";
import { cn } from "../ui";
import { AvatarMark } from "./Avatar";
import {
  FileIcon,
  GearIcon,
  KnowledgeIcon,
  MonitorIcon,
  PlugIcon,
  PlusIcon,
  RoomIcon,
  SearchIcon,
  SkillsIcon,
} from "./Icons";

function HotkeyHint(props: { hotkey: string; className?: string }) {
  if (!props.hotkey) return null;
  return (
    <kbd className={cn("hotkey-kbd", props.className)}>
      {formatForDisplay(props.hotkey)}
    </kbd>
  );
}

function ActionGlyph(props: { id: PaletteActionId }) {
  const className = "size-4 text-muted";
  if (props.id === "hire" || props.id === "section") {
    return <PlusIcon className={className} />;
  }
  if (props.id === "room") return <RoomIcon className={className} />;
  if (props.id === "computer") return <MonitorIcon className={className} />;
  if (props.id === "plugins") return <PlugIcon className={className} />;
  if (props.id === "knowledge") return <KnowledgeIcon className={className} />;
  if (props.id === "skills") return <SkillsIcon className={className} />;
  return <GearIcon className={className} />;
}

function itemLabel(item: PaletteItem): string {
  if (item.kind === "bot") return item.bot.name;
  if (item.kind === "room") return item.room.name;
  if (item.kind === "app") return item.app.title;
  if (item.kind === "file") return item.file.title.trim() || item.file.name;
  return item.action.label;
}

function itemDetail(item: PaletteItem): string {
  if (item.kind === "bot") {
    if (item.bot.archivedAt) return "Archived";
    return item.bot.title || item.bot.lastPreview || "Teammate";
  }
  if (item.kind === "room") {
    return item.room.lastPreview || item.room.memberNames || "Room";
  }
  if (item.kind === "app") return APP_KIND_LABEL[item.app.templateId];
  if (item.kind === "file") return item.file.path;
  return "Command";
}

function groupLabel(kind: PaletteItem["kind"]): string {
  if (kind === "bot") return "Teammates";
  if (kind === "room") return "Rooms";
  if (kind === "app") return "Apps";
  if (kind === "file") return "Knowledge";
  return "Commands";
}

function toPaletteRoom(room: Room): PaletteRoom {
  return {
    id: room.id,
    name: room.name,
    lastPreview: room.lastPreview,
    memberNames: room.members.map((member) => member.name).join(" "),
  };
}

export function CommandPalette(props: {
  open: boolean;
  bots: Bot[];
  rooms: Room[];
  apps: WorkspaceApp[];
  files?: PaletteFile[];
  onClose: () => void;
  onBot: (botId: string) => void;
  onRoom: (roomId: string) => void;
  onApp: (appId: string) => void;
  onFile?: (path: string) => void;
  onAction: (id: PaletteActionId) => void;
}) {
  const listId = useId();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const paletteRooms = useMemo(
    () => props.rooms.map(toPaletteRoom),
    [props.rooms],
  );
  const items = useMemo(
    () =>
      rankPaletteItems(
        query,
        props.bots,
        props.apps,
        paletteRooms,
        props.files ?? [],
      ),
    [query, props.bots, props.apps, paletteRooms, props.files],
  );
  const activeItem = items[active];
  const prefetchPaths = useMemo(
    () => paletteFilePrefetchPaths(items, active),
    [items, active],
  );

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setActive(0);
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    prefetchKnowledgeFiles(queryClient, prefetchPaths);
  }, [props.open, prefetchPaths, queryClient]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    setActive((index) => {
      if (items.length === 0) return 0;
      return Math.min(index, items.length - 1);
    });
  }, [items.length]);

  useEffect(() => {
    if (!activeItem) return;
    document
      .getElementById(`${listId}-${activeItem.key}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeItem, listId]);

  function run(item: PaletteItem | undefined) {
    if (!item) return;
    if (item.kind === "bot") props.onBot(item.bot.id);
    else if (item.kind === "room") props.onRoom(item.room.id);
    else if (item.kind === "app") props.onApp(item.app.id);
    else if (item.kind === "file") props.onFile?.(item.file.path);
    else props.onAction(item.action.id);
  }

  function move(delta: 1 | -1) {
    if (items.length === 0) return;
    setActive((index) => (index + delta + items.length) % items.length);
  }

  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="command-palette-backdrop modal-backdrop fixed inset-0 z-30 bg-black/50" />
        <Dialog.Popup
          className="command-palette modal-popup fixed top-[11vh] left-1/2 z-30 flex max-h-[min(72vh,560px)] w-[min(540px,calc(100%-32px))] flex-col overflow-hidden rounded-[18px] border border-line bg-card p-0 shadow-modal outline-none"
          initialFocus={searchRef}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
            <SearchIcon className="shrink-0 text-muted" />
            <input
              ref={searchRef}
              value={query}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search teammates, rooms, apps, files, commands…"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                activeItem ? `${listId}-${activeItem.key}` : undefined
              }
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                const action = paletteSearchKey(event.key);
                if (!action) return;
                event.preventDefault();
                if (action === "down") move(1);
                else if (action === "up") move(-1);
                else if (action === "run") run(activeItem);
                else {
                  event.stopPropagation();
                  props.onClose();
                }
              }}
            />
            <HotkeyHint hotkey="Escape" />
          </div>
          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="min-h-0 flex-1 overflow-auto p-1.5"
          >
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                Nothing matches.
              </p>
            ) : (
              items.map((item, index) => {
                const prev = items[index - 1];
                const selected = index === active;
                return (
                  <div key={item.key}>
                    {!prev || prev.kind !== item.kind ? (
                      <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                        {groupLabel(item.kind)}
                      </div>
                    ) : null}
                    <button
                      id={`${listId}-${item.key}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-[12px] border-0 px-2 py-1.5 text-left text-inherit",
                        selected ? "bg-card-2" : "bg-transparent",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => run(item)}
                    >
                      {item.kind === "bot" ? (
                        <AvatarMark
                          name={item.bot.name}
                          color={item.bot.avatarColor}
                          shape={item.bot.avatarShape}
                          size="sm"
                        />
                      ) : item.kind === "app" ? (
                        <span
                          className="grid size-7 shrink-0 place-items-center rounded-[9px] text-white"
                          style={{
                            background: APP_KIND_COLOR[item.app.templateId],
                          }}
                        >
                          <FileIcon />
                        </span>
                      ) : item.kind === "room" ? (
                        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-card-2">
                          <RoomIcon className="size-4 text-muted" />
                        </span>
                      ) : item.kind === "file" ? (
                        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-card-2">
                          <KnowledgeIcon className="size-4 text-muted" />
                        </span>
                      ) : (
                        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-card-2">
                          <ActionGlyph id={item.action.id} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {itemLabel(item)}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          {itemDetail(item)}
                        </span>
                      </span>
                      {item.kind === "action" ? (
                        <HotkeyHint hotkey={item.action.shortcut} />
                      ) : null}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SearchTrigger(props: {
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="search-field w-full cursor-pointer text-left"
      onClick={props.onOpen}
    >
      <SearchIcon />
      <span className="min-w-0 flex-1 truncate">Search</span>
      <HotkeyHint hotkey="Mod+K" />
    </button>
  );
}
