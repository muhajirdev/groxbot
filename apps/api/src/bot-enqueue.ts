import type { WakeupJob } from "@groxbot/adapter-kit";
import { getAgentByName } from "agents";

type ActorBinding = DurableObjectNamespace;

/** Address the BotActor Durable Object. Cloudflare is the mailbox. */
export async function enqueueOnBot(
  actors: ActorBinding,
  job: WakeupJob,
): Promise<void> {
  const stub = await getAgentByName(actors, job.botId);
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
