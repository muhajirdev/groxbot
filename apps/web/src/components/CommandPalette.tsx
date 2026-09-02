import type { Bot, WorkspaceApp } from "@groxbot/contracts";
import { Dialog } from "@base-ui/react/dialog";
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { useEffect, useId, useMemo, useState } from "react";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import {
  rankPaletteItems,
  type PaletteActionId,
  type PaletteItem,
} from "../lib/command-palette";
import { cn } from "../ui";
import { AvatarMark } from "./Avatar";
import {
  FileIcon,
  GearIcon,
  KnowledgeIcon,
  MonitorIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
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
  if (props.id === "hire") return <PlusIcon className={className} />;
  if (props.id === "computer") return <MonitorIcon className={className} />;
  if (props.id === "plugins") return <PlugIcon className={className} />;
  if (props.id === "knowledge") return <KnowledgeIcon className={className} />;
  return <GearIcon className={className} />;
}

function itemLabel(item: PaletteItem): string {
  if (item.kind === "bot") return item.bot.name;
  if (item.kind === "app") return item.app.title;
  return item.action.label;
}

function itemDetail(item: PaletteItem): string {
  if (item.kind === "bot") {
    if (item.bot.archivedAt) return "Archived";
    return item.bot.title || item.bot.lastPreview || "Teammate";
  }
  if (item.kind === "app") return APP_KIND_LABEL[item.app.templateId];
  return "Command";
}

function groupLabel(kind: PaletteItem["kind"]): string {
  if (kind === "bot") return "Teammates";
  if (kind === "app") return "Apps";
  return "Commands";
}

export function CommandPalette(props: {
  open: boolean;
  bots: Bot[];
  apps: WorkspaceApp[];
  onClose: () => void;
  onBot: (botId: string) => void;
  onApp: (appId: string) => void;
  onAction: (id: PaletteActionId) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(
    () => rankPaletteItems(query, props.bots, props.apps),
    [query, props.bots, props.apps],
  );
  const activeItem = items[active];

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setActive(0);
  }, [props.open]);

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

  useHotkey("Escape", () => props.onClose(), { enabled: props.open });

  function run(item: PaletteItem | undefined) {
    if (!item) return;
    if (item.kind === "bot") props.onBot(item.bot.id);
    else if (item.kind === "app") props.onApp(item.app.id);
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
        <Dialog.Popup className="command-palette modal-popup fixed top-[11vh] left-1/2 z-30 flex max-h-[min(72vh,560px)] w-[min(540px,calc(100%-32px))] flex-col overflow-hidden rounded-[18px] border border-line bg-card p-0 shadow-modal outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3">
            <SearchIcon className="shrink-0 text-muted" />
            <input
              value={query}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search teammates, apps, commands…"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                activeItem ? `${listId}-${activeItem.key}` : undefined
              }
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  run(activeItem);
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
                        "flex w-full items-center gap-2.5 rounded-[12px] border-0 bg-transparent px-2 py-1.5 text-left text-inherit",
                        selected && "bg-selected",
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
