import type { WakeupJob } from "@groxbot/adapter-kit";

type ActorStub = {
  fetch: (request: Request) => Promise<Response>;
};

type ActorBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => ActorStub;
};

/** Address the BotActor Durable Object. Cloudflare is the mailbox. */
export async function enqueueOnBot(
  actors: ActorBinding,
  job: WakeupJob,
): Promise<void> {
  const stub = actors.get(actors.idFromName(job.botId));
  const response = await stub.fetch(
    new Request("https://groxbot.internal/wakeup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        botId: job.botId,
        name: job.name,
        payload: job.payload,
        runAt: job.runAt?.toISOString(),
        jobKey: job.jobKey,
      }),
    }),
  );
  if (!response.ok) {
    throw new Error(`wakeup ${response.status}`);
  }
}
