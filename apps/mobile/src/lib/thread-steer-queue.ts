import type {
  AppendMessage,
  ExternalThreadQueueAdapter,
} from "@assistant-ui/core";

const EMPTY_QUEUE_ITEMS: ExternalThreadQueueAdapter["items"] = [];

/** Unlock mid-run send; forward to the actor instead of a local queue. */
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
