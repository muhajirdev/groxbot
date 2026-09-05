import { Menu } from "@base-ui/react/menu";
import { useMemo, useRef } from "react";
import {
  isOfficeSkillPath,
  knowledgeMenuItems,
  type KnowledgeMenuPhase,
  type KnowledgeTreeNode,
} from "../lib/knowledge-tree";
import { cn } from "../ui";
import {
  CopyIcon,
  DownloadIcon,
  PlusIcon,
  ShareIcon,
  SkillsIcon,
  TrashIcon,
} from "./Icons";

const itemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

export type KnowledgeMenuState = {
  node: KnowledgeTreeNode;
  x: number;
  y: number;
  phase: KnowledgeMenuPhase;
};

export function KnowledgeContextMenu(props: {
  menu: KnowledgeMenuState | null;
  shared: boolean;
  onClose: () => void;
  onPhase: (next: KnowledgeMenuState) => void;
  onDownload: (path: string) => void;
  onCopyPath: (path: string) => void;
  onCopyOfficeLink: (path: string) => void;
  onCopyPublicLink: (path: string) => void;
  onShare: (node: KnowledgeTreeNode) => void;
  onUnpublish: (path: string) => void;
  onUse: (node: KnowledgeTreeNode) => void;
  onNewFile: (folder: string) => void;
  onDelete: (path: string) => void;
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

  const skill =
    current.node.kind === "file" && isOfficeSkillPath(current.node.path);
  const items = knowledgeMenuItems({
    name: current.node.name,
    kind: current.node.kind,
    skill,
    phase: current.phase,
    shared: props.shared,
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
                  item.id === "delete"
                    ? `${item.id}-${current.phase}`
                    : item.id
                }
              >
                {item.id === "delete" &&
                current.phase === "actions" &&
                index > 0 ? (
                  <Menu.Separator className="mx-1 my-1 h-px bg-line" />
                ) : null}
                <Menu.Item
                  className={cn(
                    itemClass,
                    (item.id === "delete" || item.id === "unpublish") &&
                      "text-danger",
                  )}
                  closeOnClick={
                    item.id === "download" ||
                    item.id === "copy-path" ||
                    item.id === "copy-office-link" ||
                    item.id === "copy-public-link" ||
                    item.id === "use" ||
                    item.id === "new-file" ||
                    item.id === "unpublish" ||
                    item.id === "confirm-share" ||
                    (item.id === "delete" && current.phase === "confirm-delete")
                  }
                  onClick={() => {
                    if (item.id === "download") {
                      props.onDownload(current.node.path);
                      return;
                    }
                    if (item.id === "copy-path") {
                      props.onCopyPath(current.node.path);
                      return;
                    }
                    if (item.id === "copy-office-link") {
                      props.onCopyOfficeLink(current.node.path);
                      return;
                    }
                    if (item.id === "copy-public-link") {
                      props.onCopyPublicLink(current.node.path);
                      return;
                    }
                    if (item.id === "use") {
                      props.onUse(current.node);
                      return;
                    }
                    if (item.id === "new-file") {
                      props.onNewFile(current.node.path);
                      return;
                    }
                    if (item.id === "share") {
                      props.onPhase({ ...current, phase: "confirm-share" });
                      return;
                    }
                    if (item.id === "cancel-share") {
                      props.onPhase({ ...current, phase: "actions" });
                      return;
                    }
                    if (item.id === "confirm-share") {
                      props.onShare(current.node);
                      return;
                    }
                    if (item.id === "unpublish") {
                      props.onUnpublish(current.node.path);
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
                    props.onDelete(current.node.path);
                  }}
                >
                  {item.id === "download" ? (
                    <DownloadIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "copy-path" ||
                  item.id === "copy-office-link" ||
                  item.id === "copy-public-link" ? (
                    <CopyIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "share" || item.id === "confirm-share" ? (
                    <ShareIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "use" ? (
                    <SkillsIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "new-file" ? (
                    <PlusIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                  {item.id === "delete" || item.id === "unpublish" ? (
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
