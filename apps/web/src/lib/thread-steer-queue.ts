import type {
  AppendMessage,
  ExternalThreadQueueAdapter,
} from "@assistant-ui/react";

const EMPTY_QUEUE_ITEMS: ExternalThreadQueueAdapter["items"] = [];

/**
 * Assistant-ui only lets the composer send mid-run when `capabilities.queue`
 * is on. Its built-in queue cancels the live turn and starts another; Groxbot
 * already injects the user into the same Pi loop (`sendOffice` / `sendRoom`).
 * This adapter unlocks Enter/Send and forwards immediately.
 */
export function createImmediateSteerQueue(
  onNew: (message: AppendMessage) => void | Promise<void>,
): ExternalThreadQueueAdapter {
  const dispatch = (message: AppendMessage) => {
    void onNew(message);
  };
  return {
    items: EMPTY_QUEUE_ITEMS,
    steerItems: EMPTY_QUEUE_ITEMS,
    enqueue: dispatch,
    steer: dispatch,
    move: () => {},
    edit: () => {},
    remove: () => {},
  };
}
