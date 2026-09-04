import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { cn } from "./cn";

export function ModalShell(props: {
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open, eventDetails) => {
        if (open) return;
        if (eventDetails.reason === "outside-press") {
          const target =
            "target" in eventDetails.event ? eventDetails.event.target : null;
          if (
            target instanceof Element &&
            target.closest(".popover-popup")
          ) {
            eventDetails.cancel();
            return;
          }
        }
        props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop fixed inset-0 z-20 bg-black/55" />
        <Dialog.Popup
          className={cn(
            "modal-popup fixed top-1/2 left-1/2 z-20 max-h-[min(86vh,900px)] w-[min(420px,calc(100%-48px))] overflow-auto rounded-[12px] border border-line bg-card p-4 shadow-modal outline-none",
            props.wide &&
              "flex w-[min(860px,calc(100%-48px))] flex-col overflow-hidden p-0",
            props.className,
          )}
        >
          {props.children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
