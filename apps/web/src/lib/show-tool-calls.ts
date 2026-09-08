import { useSyncExternalStore } from "react";

/** Expandable tool args/results. Compact activity rows always show. Console: localStorage.setItem("groxbot.showToolCalls", "1"); location.reload() */
export const SHOW_TOOL_CALLS_KEY = "groxbot.showToolCalls";
const EVENT = "groxbot-show-tool-calls";

export function readShowToolCalls(): boolean {
  try {
    return localStorage.getItem(SHOW_TOOL_CALLS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShowToolCalls(on: boolean): void {
  try {
    localStorage.setItem(SHOW_TOOL_CALLS_KEY, on ? "1" : "0");
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribeShowToolCalls(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === SHOW_TOOL_CALLS_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

export function useShowToolCalls(): boolean {
  return useSyncExternalStore(
    subscribeShowToolCalls,
    readShowToolCalls,
    () => false,
  );
}
