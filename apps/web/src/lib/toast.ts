export const TOAST_LINK_COPIED = "Link copied";
export const TOAST_SHARED_LINK_COPIED = "Shared. Link copied";
export const TOAST_SHARED = "Shared";

export type OfficeToastState = { id: number; message: string };

const HOLD_MS = 2200;

let seq = 0;
let current: OfficeToastState | null = null;
let timer = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getToast(): OfficeToastState | null {
  return current;
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast() {
  if (timer) {
    globalThis.clearTimeout(timer);
    timer = 0;
  }
  if (!current) return;
  current = null;
  emit();
}

export function toast(message: string) {
  seq += 1;
  current = { id: seq, message };
  if (timer) globalThis.clearTimeout(timer);
  timer = globalThis.setTimeout(() => {
    timer = 0;
    current = null;
    emit();
  }, HOLD_MS);
  emit();
}

export async function copyAndToast(
  text: string,
  message: string,
): Promise<boolean> {
  if (!text || typeof navigator === "undefined" || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
    return true;
  } catch {
    return false;
  }
}
