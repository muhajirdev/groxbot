import type { PiBoundMessage, PiUserMessage } from "./pi-transcript.js";

export type PiQueuedUser = {
  id: string;
  content: string;
  metadata?: unknown;
  timestamp: number;
};

export type PiSteerMode = "one-at-a-time" | "all";

export function drainPiQueuedUsers(
  queue: PiQueuedUser[],
  mode: PiSteerMode = "all",
): PiQueuedUser[] {
  if (queue.length === 0) return [];
  if (mode === "one-at-a-time") {
    const next = queue.shift();
    return next ? [next] : [];
  }
  return queue.splice(0, queue.length);
}

export function piQueuedUserMessage(row: PiQueuedUser): PiUserMessage {
  return {
    role: "user",
    content: row.content,
    timestamp: row.timestamp,
  };
}

export function piQueuedUserBound(row: PiQueuedUser): PiBoundMessage {
  const bound: PiBoundMessage = {
    id: row.id,
    message: piQueuedUserMessage(row),
  };
  if (row.metadata !== undefined) bound.metadata = row.metadata;
  return bound;
}

/** In-memory steer/follow-up queue for one Pi `runAgentLoopContinue`. */
export class PiSteerQueue {
  private waiting: PiQueuedUser[] = [];
  private emitted: PiQueuedUser[] = [];

  push(row: PiQueuedUser): void {
    this.waiting.push(row);
  }

  drainMessages(): PiUserMessage[] {
    const batch = drainPiQueuedUsers(this.waiting);
    this.emitted.push(...batch);
    return batch.map(piQueuedUserMessage);
  }

  peekEmitted(): PiQueuedUser | undefined {
    return this.emitted[0];
  }

  takeEmitted(): PiQueuedUser | undefined {
    return this.emitted.shift();
  }

  pending(): PiQueuedUser[] {
    return [...this.waiting, ...this.emitted];
  }

  takeAll(): PiQueuedUser[] {
    return [...this.emitted.splice(0), ...this.waiting.splice(0)];
  }
}
