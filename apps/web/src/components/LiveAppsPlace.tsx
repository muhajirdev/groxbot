import type { WorkspaceApp } from "@groxbot/contracts";
import { APP_KIND_COLOR, APP_KIND_LABEL } from "../lib/app-kind";
import { formatListTime } from "../lib/time";
import { cn } from "../ui";

export function LiveAppsList(props: {
  apps: readonly WorkspaceApp[];
  openAppId?: string;
  freshIds?: ReadonlySet<string>;
  onOpen: (appId: string) => void;
}) {
  if (props.apps.length === 0) {
    return (
      <p className="desk-empty px-2 py-6 text-[13px] leading-normal">
        No live apps yet. Ask a teammate to make one.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-col gap-0.5">
      {props.apps.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2 py-2 text-left text-inherit hover:bg-hover",
            props.openAppId === item.id && "bg-selected",
          )}
          onClick={() => props.onOpen(item.id)}
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-[9px] text-[10px] font-semibold tracking-wide text-white"
            style={{ background: APP_KIND_COLOR[item.templateId] }}
          >
            {APP_KIND_LABEL[item.templateId].slice(0, 3)}
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-semibold">
                {item.title}
              </span>
              <span className="shrink-0 text-[11px] text-muted">
                {formatListTime(item.createdAt)}
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              <span className="truncate">{APP_KIND_LABEL[item.templateId]}</span>
              {props.freshIds?.has(item.id) ? (
                <span className="apps-fresh-chip">New</span>
              ) : null}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
