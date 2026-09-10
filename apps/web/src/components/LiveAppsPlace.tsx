import type { WorkspaceApp } from "@groxbot/contracts";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { cn } from "../ui";
import { CloseIcon } from "./Icons";

export function LiveAppsPlace(props: {
  apps: readonly WorkspaceApp[];
  openAppId?: string;
  onOpen: (appId: string) => void;
  onCollapse: () => void;
}) {
  return (
    <aside className="pane">
      <div className="pane-head drag">
        <span className="pane-title">Live apps</span>
        <div className="row tight no-drag">
          <button
            className="icon-btn"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onCollapse}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto px-2 py-2">
        {props.apps.length === 0 ? (
          <p className="desk-empty px-2 py-6 text-[13px] leading-normal">
            No live apps yet. Ask a teammate to make a doc, deck, sheet, CRM, or
            game.
          </p>
        ) : (
          props.apps.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "grid min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border-0 bg-transparent px-2 py-2 text-left text-inherit hover:bg-hover",
                props.openAppId === item.id && "bg-selected",
              )}
              onClick={() => props.onOpen(item.id)}
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[11px] font-semibold tracking-wide text-white"
                style={{ background: APP_KIND_COLOR[item.templateId] }}
              >
                {APP_KIND_LABEL[item.templateId].slice(0, 3)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted">
                  {APP_KIND_LABEL[item.templateId]}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
