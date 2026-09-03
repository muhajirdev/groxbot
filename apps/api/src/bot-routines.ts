import type { Routine } from "@groxbot/contracts";
import {
  RoutineError,
  RoutineNotFoundError,
  RoutineScheduleError,
} from "@groxbot/core";
import { getAgentByName } from "agents";

type ActorBinding = DurableObjectNamespace;

export type RoutineCreateBody = {
  name: string;
  prompt: string;
  cron: string;
  timezone?: string;
};

/** Recurring jobs on this bot’s Think actor. Not a Postgres catalog. */
export async function listBotRoutines(
  actors: ActorBinding,
  botId: string,
): Promise<Routine[]> {
  const payload = await callBotRoutines<{ routines: Routine[] }>(
    actors,
    botId,
    "/routines/list",
    {},
  );
  if (!Array.isArray(payload.routines)) throw new RoutineError();
  return payload.routines;
}

export async function createBotRoutine(
  actors: ActorBinding,
  botId: string,
  input: RoutineCreateBody,
): Promise<Routine> {
  return callBotRoutines<Routine>(actors, botId, "/routines/create", input);
}

export async function pauseBotRoutine(
  actors: ActorBinding,
  botId: string,
  id: string,
): Promise<Routine> {
  return callBotRoutines<Routine>(actors, botId, "/routines/pause", { id });
}

export async function resumeBotRoutine(
  actors: ActorBinding,
  botId: string,
  id: string,
): Promise<Routine> {
  return callBotRoutines<Routine>(actors, botId, "/routines/resume", { id });
}

export async function removeBotRoutine(
  actors: ActorBinding,
  botId: string,
  id: string,
): Promise<void> {
  await callBotRoutines(actors, botId, "/routines/remove", { id });
}

/** Archive: keep the catalog, stop Think from firing until unarchived. */
export async function suspendBotRoutines(
  actors: ActorBinding,
  botId: string,
  suspended: boolean,
): Promise<void> {
  await callBotRoutines(actors, botId, "/routines/suspend", { suspended });
}

async function callBotRoutines<T>(
  actors: ActorBinding,
  botId: string,
  pathname: string,
  body: Record<string, unknown>,
): Promise<T> {
  const stub = await getAgentByName(actors, botId);
  const response = await stub.fetch(
    new Request(`https://groxbot.internal${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json().catch(() => ({}))) as {
    error?: unknown;
  } & T;
  const message = typeof payload.error === "string" ? payload.error : undefined;
  if (response.status === 404) throw new RoutineNotFoundError(message);
  if (response.status === 400) {
    if (
      message?.toLowerCase().includes("timezone") ||
      message?.toLowerCase().includes("schedule")
    ) {
      throw new RoutineScheduleError(message);
    }
    throw new RoutineError(message);
  }
  if (!response.ok) {
    throw new RoutineError(message || `routine ${response.status}`);
  }
  return payload;
}
