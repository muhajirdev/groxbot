import { Menu } from "@base-ui/react/menu";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { userFacingError } from "../lib/errors";
import { OFFICE_TO, officeParams } from "../lib/office-route";
import { workspaceListQueryOptions } from "../lib/office-persist";
import { client } from "../lib/rpc";
import { setRpcWorkspaceId } from "../lib/rpc-workspace";
import { enterActiveWorkspace } from "../lib/session";
import {
  readCachedWorkspace,
  resolveWorkspace,
  type WorkspaceMenuItem,
  workspaceDisplayName,
  workspaceMenuItems,
  writeCachedWorkspace,
} from "../lib/workspace-switcher";
import { cn } from "../ui";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { CheckIcon, ChevronDownIcon, PlusIcon } from "./Icons";

export function WorkspaceSwitcher(props: {
  name?: string | null;
  workspaceId?: string | null;
  workspaceSlug?: string | null;
}) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cached, setCached] = useState(readCachedWorkspace);
  const remembered = resolveWorkspace({
    id: props.workspaceId,
    name: props.name,
    cached,
  });
  const label = workspaceDisplayName(remembered.name);
  const listQuery = useQuery(workspaceListQueryOptions());
  const items = workspaceMenuItems({
    currentId: remembered.id,
    currentName: remembered.name,
    currentSlug: props.workspaceSlug,
    others: listQuery.data,
  });

  useEffect(() => {
    const id = props.workspaceId?.trim();
    const name = props.name?.trim();
    const slug = props.workspaceSlug?.trim();
    if (!id || !name) return;
    writeCachedWorkspace({ id, name, slug });
    setCached(slug ? { id, name, slug } : { id, name });
  }, [props.workspaceId, props.name, props.workspaceSlug]);

  async function enterOffice(workspace: {
    id: string;
    name: string;
    slug: string;
  }) {
    await enterActiveWorkspace({
      workspace,
      goOnboarding: () =>
        navigate({ to: "/onboarding", search: {}, viewTransition: true }),
      goBot: (roomId) =>
        navigate({
          to: OFFICE_TO,
          params: officeParams(workspace.slug, roomId),
          viewTransition: true,
        }),
    });
  }

  async function onCreate(name: string) {
    setBusy(true);
    setCreateError(null);
    try {
      const created = await client.workspaces.create({ name });
      setRpcWorkspaceId(created.id);
      writeCachedWorkspace(created);
      setCached(created);
      setCreateOpen(false);
      await enterOffice(created);
    } catch (caught) {
      setCreateError(userFacingError(caught, "Could not create workspace"));
    } finally {
      setBusy(false);
    }
  }

  async function onItem(item: WorkspaceMenuItem) {
    if (item.kind === "create") {
      setNotice(null);
      setCreateError(null);
      setCreateOpen(true);
      return;
    }
    if (item.current) return;
    setNotice(null);
    setCached({ id: item.id, name: item.name, slug: item.slug });
    void client.workspaces.activate({ workspaceId: item.id }).catch((caught) => {
      setNotice(userFacingError(caught, "Could not switch workspace"));
    });
    try {
      await enterOffice(item);
    } catch (caught) {
      setNotice(userFacingError(caught, "Could not switch workspace"));
    }
  }

  return (
    <>
      <Menu.Root
        modal={false}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
      >
        <Menu.Trigger
          className="group no-drag flex w-full min-w-0 items-center gap-1 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left text-ink outline-none transition-[background-color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent data-popup-open:bg-hover"
          aria-label="Switch workspace"
        >
          <span className="min-w-0 truncate text-sm font-semibold">
            {label}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted transition-transform group-data-popup-open:rotate-180" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            className="z-50 outline-none"
            side="bottom"
            sideOffset={6}
            align="start"
          >
            <Menu.Popup className="popover-popup min-w-[200px] max-w-[260px] rounded-[10px] border border-line bg-card p-1 outline-none">
              {items.map((item, index) => {
                if (item.kind === "create") {
                  return (
                    <div key="create">
                      {index > 0 ? (
                        <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                      ) : null}
                      <Menu.Item
                        className={menuItemClass}
                        disabled={busy}
                        onClick={() => void onItem(item)}
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
                    disabled={busy && !item.current}
                    onClick={() => void onItem(item)}
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
      <CreateWorkspaceDialog
        open={createOpen}
        busy={busy}
        error={createError}
        onClose={() => {
          if (busy) return;
          setCreateOpen(false);
          setCreateError(null);
        }}
        onCreate={(name) => void onCreate(name)}
      />
    </>
  );
}

const menuItemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);
