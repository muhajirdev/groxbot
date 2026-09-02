import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import {
  workspaceActionNotice,
  workspaceDisplayName,
  workspaceMenuItems,
  type WorkspaceMenuItem,
} from "../lib/workspace-switcher";
import { cn } from "../ui";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "./Icons";

export function WorkspaceSwitcher(props: {
  name?: string | null;
  workspaceId?: string | null;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const label = workspaceDisplayName(props.name);
  const items = workspaceMenuItems({
    currentId: props.workspaceId,
    currentName: props.name,
  });

  function onItem(item: WorkspaceMenuItem) {
    const next = workspaceActionNotice(item);
    if (next) {
      setNotice(next);
      return;
    }
    setNotice(null);
  }

  return (
    <Menu.Root
      modal={false}
      onOpenChange={(open) => {
        if (!open) setNotice(null);
      }}
    >
      <Menu.Trigger
        className="group no-drag flex w-full min-w-0 items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-ink outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-hover"
        aria-label="Switch workspace"
      >
        <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted transition-transform group-data-popup-open:rotate-180" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={6}
          align="start"
        >
          <Menu.Popup className="min-w-[200px] max-w-[260px] rounded-[10px] border border-line bg-card p-1 shadow-modal outline-none">
            {items.map((item, index) => {
              if (item.kind === "create") {
                return (
                  <div key="create">
                    {index > 0 ? (
                      <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                    ) : null}
                    <Menu.Item
                      className={menuItemClass}
                      closeOnClick={false}
                      onClick={() => onItem(item)}
                    >
                      <PlusIcon className="size-3.5 shrink-0 text-muted" />
                      Create workspace
                    </Menu.Item>
                  </div>
                );
              }
              return (
                <Menu.Item
                  key={item.id}
                  className={menuItemClass}
                  closeOnClick={!item.current ? false : undefined}
                  onClick={() => onItem(item)}
                >
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.current ? (
                    <CheckIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                </Menu.Item>
              );
            })}
            {notice ? (
              <p
                className="mt-1 border-t border-line px-2.5 py-1.5 text-[12px] text-muted"
                role="status"
              >
                {notice}
              </p>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const menuItemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
);
