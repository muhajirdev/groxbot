import { useSyncExternalStore } from "react";
import { getToast, subscribeToast } from "../lib/toast";
import { CheckIcon } from "./Icons";
import { cn } from "../ui";

export function OfficeToast(props: { message: string; leaving?: boolean }) {
  return (
    <div
      className={cn("office-toast", props.leaving && "is-out")}
      role="status"
    >
      <span className="office-toast-mark" aria-hidden>
        <CheckIcon className="size-3.5" />
      </span>
      <span className="office-toast-copy">{props.message}</span>
    </div>
  );
}

export function ToastHost() {
  const current = useSyncExternalStore(subscribeToast, getToast, () => null);
  if (!current) return null;
  return (
    <div className="office-toasts" aria-live="polite">
      <OfficeToast
        key={current.id}
        message={current.message}
        leaving={current.leaving}
      />
    </div>
  );
}
