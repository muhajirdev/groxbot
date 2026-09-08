import { useSyncExternalStore } from "react";
import { readDebugMode, subscribeDebugMode } from "./debug-mode";

const MAX_LINES = 400;
const EVENT = "groxbot-office-debug";

const linesByThread = new Map<string, string[]>();

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function appendOfficeDebugLine(threadId: string, line: string): void {
  const id = threadId.trim();
  const text = line.trim();
  if (!id || !text) return;
  if (!readDebugMode()) return;
  const prev = linesByThread.get(id) ?? [];
  const next = [...prev, text];
  if (next.length > MAX_LINES) next.splice(0, next.length - MAX_LINES);
  linesByThread.set(id, next);
  notify();
}

export function clearOfficeDebugLines(threadId: string): void {
  const id = threadId.trim();
  if (!id) return;
  linesByThread.delete(id);
  notify();
}

export function readOfficeDebugLines(threadId: string): string[] {
  return linesByThread.get(threadId.trim()) ?? EMPTY;
}

export function subscribeOfficeDebug(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onStoreChange);
  const unsubPref = subscribeDebugMode(onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    unsubPref();
  };
}

export function useOfficeDebugLines(threadId: string): string[] {
  const id = threadId.trim();
  return useSyncExternalStore(
    subscribeOfficeDebug,
    () => (readDebugMode() ? readOfficeDebugLines(id) : EMPTY),
    () => EMPTY,
  );
}

const EMPTY: string[] = [];
