import type { Routine } from "@groxbot/contracts";
import { OFFICE_MESSAGES_GC_TIME } from "./office-messages";
import { orpc, queryClient } from "./orpc";

export function routinesListQueryOptions(botId: string) {
  return {
    ...orpc.routines.list.queryOptions({ input: { botId } }),
    gcTime: OFFICE_MESSAGES_GC_TIME,
  };
}

export function routinesListKey(botId: string) {
  return routinesListQueryOptions(botId).queryKey;
}

export function readRoutines(botId: string): Routine[] {
  return queryClient.getQueryData<Routine[]>(routinesListKey(botId)) ?? [];
}

export function writeRoutines(botId: string, next: Routine[]): void {
  queryClient.setQueryData(routinesListKey(botId), next);
}

export function optimisticRoutine(input: {
  botId: string;
  name: string;
  prompt: string;
  cron: string;
  timezone: string;
}): Routine {
  return {
    id: crypto.randomUUID(),
    botId: input.botId,
    name: input.name.trim(),
    prompt: input.prompt.trim(),
    cron: input.cron.trim(),
    timezone: input.timezone,
    active: true,
    nextRunAt: null,
  };
}

export function withRoutineActive(
  list: readonly Routine[],
  id: string,
  active: boolean,
): Routine[] {
  return list.map((row) =>
    row.id === id
      ? { ...row, active, nextRunAt: active ? row.nextRunAt : null }
      : row,
  );
}

export function withRoutineFields(
  list: readonly Routine[],
  id: string,
  patch: Pick<Routine, "name" | "prompt" | "cron" | "timezone">,
): Routine[] {
  return list.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function withoutRoutine(list: readonly Routine[], id: string): Routine[] {
  return list.filter((row) => row.id !== id);
}

export function replaceRoutine(
  list: readonly Routine[],
  fromId: string,
  next: Routine,
): Routine[] {
  let found = false;
  const mapped = list.map((row) => {
    if (row.id !== fromId) return row;
    found = true;
    return next;
  });
  return found ? mapped : [...mapped, next];
}
