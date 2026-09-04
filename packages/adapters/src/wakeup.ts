import type { WakeupDriver, WakeupJob } from "@groxbot/adapter-kit";

type Handler = (payload: Record<string, unknown>) => Promise<void>;

interface QueuedActor {
  tail: Promise<void>;
  timers: Map<string, NodeJS.Timeout>;
}

/**
 * In-process queue per bot: serial runs + named delayed schedules.
 * Product cron is Agents `this.schedule` on the home RoomActor, not this driver.
 */
export class InProcessWakeupDriver implements WakeupDriver {
  private handlers: Record<string, Handler> = {};
  private actors = new Map<string, QueuedActor>();

  async enqueue(job: WakeupJob): Promise<void> {
    if (!job.botId) throw new Error("WakeupJob.botId is required");
    const delay = job.runAt ? Math.max(0, job.runAt.getTime() - Date.now()) : 0;
    const actor = this.actor(job.botId);
    if (job.jobKey) {
      const existing = actor.timers.get(job.jobKey);
      if (existing) clearTimeout(existing);
    }
    if (delay === 0) {
      this.push(job);
      return;
    }
    const timer = setTimeout(() => {
      if (job.jobKey) actor.timers.delete(job.jobKey);
      this.push(job);
    }, delay);
    if (job.jobKey) actor.timers.set(job.jobKey, timer);
  }

  async start(handlers: Record<string, Handler>): Promise<void> {
    this.handlers = handlers;
  }

  async stop(): Promise<void> {
    for (const actor of this.actors.values()) {
      for (const timer of actor.timers.values()) clearTimeout(timer);
      actor.timers.clear();
    }
    this.actors.clear();
    this.handlers = {};
  }

  private actor(botId: string): QueuedActor {
    let actor = this.actors.get(botId);
    if (!actor) {
      actor = { tail: Promise.resolve(), timers: new Map() };
      this.actors.set(botId, actor);
    }
    return actor;
  }

  private push(job: WakeupJob): void {
    const actor = this.actor(job.botId);
    actor.tail = actor.tail
      .then(async () => {
        const handler = this.handlers[job.name];
        if (!handler) return;
        await handler({ ...job.payload, botId: job.botId });
      })
      .catch((error) => {
        console.error("bot actor", job.botId, job.name, error);
      });
  }
}

/** API talks to the worker that hosts actors. */
export class WakeupHttpClient implements WakeupDriver {
  constructor(private readonly baseUrl: string) {}

  async enqueue(job: WakeupJob): Promise<void> {
    const response = await fetch(new URL("/wakeup", this.baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        botId: job.botId,
        name: job.name,
        payload: job.payload,
        runAt: job.runAt?.toISOString(),
        jobKey: job.jobKey,
      }),
    });
    if (!response.ok) {
      throw new Error(`wakeup ${response.status}`);
    }
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
}

export function createWakeupDriver(workerUrl?: string): WakeupDriver {
  if (workerUrl) return new WakeupHttpClient(workerUrl);
  return new InProcessWakeupDriver();
}
