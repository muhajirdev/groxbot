import { useSyncExternalStore } from "react";

/** Turn timeline + computer debug log. Console: localStorage.setItem("groxbot.debug", "1") */
export const DEBUG_MODE_KEY = "groxbot.debug";
const EVENT = "groxbot-debug-mode";

export function readDebugMode(): boolean {
  try {
    return localStorage.getItem(DEBUG_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDebugMode(on: boolean): void {
  try {
    localStorage.setItem(DEBUG_MODE_KEY, on ? "1" : "0");
  } catch {
    return;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function subscribeDebugMode(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEBUG_MODE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStoreChange);
  };
}

export function useDebugMode(): boolean {
  return useSyncExternalStore(subscribeDebugMode, readDebugMode, () => false);
}
