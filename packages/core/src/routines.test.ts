import { describe, expect, it } from "vitest";
import {
  createStoredRoutine,
  formatRoutinePrompt,
  isIntervalSchedule,
  MemoryRoutineStore,
  parseRoutineSchedule,
  RoutineNotFoundError,
  RoutineScheduleError,
  thinkScheduledTasks,
  toRoutineDto,
} from "./routines.js";

describe("parseRoutineSchedule", () => {
  it("keeps Think wall-clock strings", () => {
    expect(parseRoutineSchedule("every weekday at 09:00")).toEqual({
      kind: "wall-clock",
      schedule: "every weekday at 09:00",
      timezone: "UTC",
    });
  });

  it("maps the office cron presets", () => {
    expect(parseRoutineSchedule("0 9 * * *")).toEqual({
      kind: "wall-clock",
      schedule: "every day at 09:00",
      timezone: "UTC",
    });
    expect(parseRoutineSchedule("0 22 * * *")).toEqual({
      kind: "wall-clock",
      schedule: "every day at 22:00",
      timezone: "UTC",
    });
    expect(parseRoutineSchedule("0 9 * * 1-5")).toEqual({
      kind: "wall-clock",
      schedule: "every weekday at 09:00",
      timezone: "UTC",
    });
  });

  it("maps weekly cron and interval cron", () => {
    expect(parseRoutineSchedule("30 8 * * 1")).toEqual({
      kind: "wall-clock",
      schedule: "every week on monday at 08:30",
      timezone: "UTC",
    });
    expect(parseRoutineSchedule("*/15 * * * *")).toEqual({
      kind: "interval",
      schedule: "every 15 minutes",
      timezone: "UTC",
    });
  });

  it("reads an inline timezone", () => {
    expect(
      parseRoutineSchedule("every day at 09:00 in America/New_York"),
    ).toEqual({
      kind: "wall-clock",
      schedule: "every day at 09:00",
      timezone: "America/New_York",
    });
  });

  it("pads a single-digit hour so Think will accept it", () => {
    expect(parseRoutineSchedule("every day at 9:00")).toEqual({
      kind: "wall-clock",
      schedule: "every day at 09:00",
      timezone: "UTC",
    });
  });

  it("rejects junk", () => {
    expect(() => parseRoutineSchedule("tomorrow")).toThrow(
      RoutineScheduleError,
    );
    expect(() => parseRoutineSchedule("0 9 1 * *")).toThrow(
      RoutineScheduleError,
    );
    expect(() => parseRoutineSchedule("every day at 24:00")).toThrow(
      RoutineScheduleError,
    );
  });
});

describe("createStoredRoutine", () => {
  it("stores a Think task Think can fire", () => {
    const row = createStoredRoutine({
      name: " Nightly Gmail ",
      prompt: " Check overnight mail. ",
      cron: "0 22 * * *",
    });
    expect(row.name).toBe("Nightly Gmail");
    expect(row.prompt).toBe("Check overnight mail.");
    expect(row.schedule).toBe("every day at 22:00");
    expect(row.active).toBe(true);
    expect(isIntervalSchedule(row.schedule)).toBe(false);
    const tasks = thinkScheduledTasks([row]);
    expect(tasks[row.id]).toEqual({
      schedule: "every day at 22:00",
      timezone: "UTC",
      prompt: formatRoutinePrompt(row.name, row.prompt),
      metadata: { name: row.name, source: "routine" },
    });
    expect(toRoutineDto("bot_1", row, 1_700_000_000_000)).toMatchObject({
      botId: "bot_1",
      cron: "every day at 22:00",
      active: true,
      nextRunAt: new Date(1_700_000_000_000).toISOString(),
    });
  });

  it("omits paused jobs from Think", () => {
    const row = createStoredRoutine({
      name: "Digest",
      prompt: "Write the digest.",
      cron: "every day at 09:00",
    });
    row.active = false;
    expect(thinkScheduledTasks([row])).toEqual({});
  });

  it("omits timezone on interval jobs", () => {
    const row = createStoredRoutine({
      name: "Pulse",
      prompt: "Check the inbox.",
      cron: "every 15 minutes",
    });
    expect(thinkScheduledTasks([row])[row.id]).toEqual({
      schedule: "every 15 minutes",
      prompt: formatRoutinePrompt(row.name, row.prompt),
      metadata: { name: row.name, source: "routine" },
    });
  });
});

describe("MemoryRoutineStore", () => {
  it("creates, pauses, and removes", () => {
    const store = new MemoryRoutineStore();
    const created = store.create("bot_a", {
      name: "Digest",
      prompt: "Write the digest.",
      cron: "every weekday at 09:00",
    });
    expect(store.list("bot_a")).toHaveLength(1);
    expect(store.setActive("bot_a", created.id, false).active).toBe(false);
    store.remove("bot_a", created.id);
    expect(store.list("bot_a")).toEqual([]);
    expect(() => store.remove("bot_a", created.id)).toThrow(
      RoutineNotFoundError,
    );
  });
});
