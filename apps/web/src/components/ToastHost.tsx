import { useSyncExternalStore } from "react";
import { getToast, subscribeToast } from "../lib/toast";
import { CheckIcon } from "./Icons";

export function OfficeToast(props: { message: string }) {
  return (
    <div className="office-toast" role="status">
      <CheckIcon className="ok size-3.5 shrink-0" />
      <span>{props.message}</span>
    </div>
  );
}

export function ToastHost() {
  const current = useSyncExternalStore(subscribeToast, getToast, () => null);
  if (!current) return null;
  return (
    <div className="office-toasts" aria-live="polite">
      <OfficeToast key={current.id} message={current.message} />
    </div>
  );
}
