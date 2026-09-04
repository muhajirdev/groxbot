import { describe, expect, it, vi } from "vitest";
import type { AppendMessage } from "@assistant-ui/react";
import { createImmediateSteerQueue } from "./thread-steer-queue";

function user(text: string): AppendMessage {
  return {
    role: "user",
    content: [{ type: "text", text }],
    attachments: [],
    createdAt: new Date(0),
    parentId: null,
    sourceId: null,
    runConfig: undefined,
    metadata: { custom: {} },
  } as AppendMessage;
}

describe("createImmediateSteerQueue", () => {
  it("forwards enqueue and steer to onNew without buffering", () => {
    const onNew = vi.fn();
    const queue = createImmediateSteerQueue(onNew);
    const first = user("first");
    const next = user("redirect");

    queue.enqueue(first);
    queue.steer(next);

    expect(onNew).toHaveBeenCalledTimes(2);
    expect(onNew).toHaveBeenNthCalledWith(1, first);
    expect(onNew).toHaveBeenNthCalledWith(2, next);
    expect(queue.items).toEqual([]);
    expect(queue.steerItems).toEqual([]);
  });
});
