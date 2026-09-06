import { afterEach, describe, expect, it } from "vitest";
import { queryClient } from "./orpc";
import {
  optimisticRoutine,
  readRoutines,
  replaceRoutine,
  routinesListKey,
  withRoutineActive,
  withRoutineFields,
  withoutRoutine,
  writeRoutines,
} from "./routines-cache";

const botId = "bot-1";

function routine(id: string, active = true) {
  return optimisticRoutine({
    botId,
    name: id,
    prompt: "check mail",
    cron: "every 5 minutes",
    timezone: "UTC",
  });
}

afterEach(() => {
  queryClient.removeQueries({ queryKey: routinesListKey(botId) });
});

describe("routines cache", () => {
  it("writes and reads the list for a bot", () => {
    const row = { ...routine("mail"), id: "r1" };
    writeRoutines(botId, [row]);
    expect(readRoutines(botId)).toEqual([row]);
  });

  it("flips pause without waiting on the server row", () => {
    const row = {
      ...routine("mail"),
      id: "r1",
      nextRunAt: "2026-09-06T13:30:00.000Z",
    };
    expect(withRoutineActive([row], "r1", false)).toEqual([
      { ...row, active: false, nextRunAt: null },
    ]);
  });

  it("drops and replaces by id", () => {
    const mail = { ...routine("mail"), id: "r1" };
    const next = { ...mail, name: "Inbox" };
    expect(withoutRoutine([mail], "r1")).toEqual([]);
    expect(replaceRoutine([mail], "r1", next)).toEqual([next]);
    expect(replaceRoutine([], "draft", next)).toEqual([next]);
  });

  it("patches name and schedule without waiting on the server", () => {
    const mail = { ...routine("mail"), id: "r1" };
    expect(
      withRoutineFields([mail], "r1", {
        name: "Inbox",
        prompt: "check mail",
        cron: "every day at 09:00",
        timezone: "UTC",
      }),
    ).toEqual([
      {
        ...mail,
        name: "Inbox",
        cron: "every day at 09:00",
      },
    ]);
  });
});
