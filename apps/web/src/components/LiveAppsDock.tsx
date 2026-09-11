import type { WorkspaceApp } from "@groxbot/contracts";
import { useState } from "react";
import { useDockLabelsHidden, useIconPress } from "../lib/icon-press";
import { cn, ModalShell } from "../ui";
import { LiveAppsIcon } from "./Icons";
import { LiveAppsList } from "./LiveAppsPlace";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function LiveAppsDock(props: {
  apps: readonly WorkspaceApp[];
  openAppId?: string;
  freshIds: readonly string[];
  onOpen: (appId: string) => void;
  onOpenedList: () => void;
}) {
  const press = useIconPress();
  const tip = useDockLabelsHidden();
  const [open, setOpen] = useState(false);
  const fresh = props.freshIds.length > 0;
  const freshSet = new Set(props.freshIds);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          className={cn("chat-dock-item", fresh && "is-fresh")}
          type="button"
          aria-label="Live apps"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={open}
          onClick={() => {
            setOpen(true);
            props.onOpenedList();
          }}
          {...press}
        >
          <span className="chat-dock-ico">
            <LiveAppsIcon className="size-5" />
            {fresh ? <span className="apps-fresh-dot" aria-hidden /> : null}
          </span>
          <span>Live apps</span>
        </TooltipTrigger>
        {tip ? (
          <TooltipContent side="top" sideOffset={6}>
            Live apps
          </TooltipContent>
        ) : null}
      </Tooltip>
      <ModalShell
        open={open}
        className="live-apps-dialog"
        onClose={() => setOpen(false)}
      >
        <div className="grid gap-3">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Live apps
          </h2>
          <div className="live-apps-dialog-body">
            <LiveAppsList
              apps={props.apps}
              openAppId={props.openAppId}
              freshIds={freshSet}
              onOpen={(appId) => {
                setOpen(false);
                props.onOpen(appId);
              }}
            />
          </div>
        </div>
      </ModalShell>
    </>
  );
}
