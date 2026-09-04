import { describe, expect, it } from "vitest";
import {
  agentRoutineWhen,
  createStoredRoutine,
  isIntervalSchedule,
  MemoryRoutineStore,
  parseRoutineClock,
  parseRoutineSchedule,
  RoutineNotFoundError,
  RoutineScheduleError,
  toRoutineDto,
  wallClockToUtcCron,
} from "./routines.js";

describe("parseRoutineSchedule", () => {
  it("keeps wall-clock strings", () => {
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

  it("pads a single-digit hour", () => {
    expect(parseRoutineSchedule("every day at 9:00")).toEqual({
      kind: "wall-clock",
      schedule: "every day at 09:00",
      timezone: "UTC",
    });
  });

  it("reads 12-hour clocks", () => {
    expect(parseRoutineSchedule("every day at 9:00 AM")).toEqual({
      kind: "wall-clock",
      schedule: "every day at 09:00",
      timezone: "UTC",
    });
    expect(parseRoutineSchedule("every weekday at 12:30 am")).toEqual({
      kind: "wall-clock",
      schedule: "every weekday at 00:30",
      timezone: "UTC",
    });
    expect(parseRoutineSchedule("every week on monday at 9pm")).toEqual({
      kind: "wall-clock",
      schedule: "every week on monday at 21:00",
      timezone: "UTC",
    });
    expect(parseRoutineClock("12:00 PM")).toBe("12:00");
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
  it("maps office copy onto an Agents cron", () => {
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
    expect(agentRoutineWhen(parseRoutineSchedule(row.schedule))).toEqual({
      kind: "cron",
      cron: "0 22 * * *",
    });
    expect(toRoutineDto("bot_1", row, 1_700_000_000_000)).toMatchObject({
      botId: "bot_1",
      cron: "every day at 22:00",
      active: true,
      nextRunAt: new Date(1_700_000_000_000).toISOString(),
    });
  });

  it("uses scheduleEvery when cron cannot express the interval", () => {
    expect(agentRoutineWhen(parseRoutineSchedule("every 7 minutes"))).toEqual({
      kind: "interval",
      intervalSeconds: 7 * 60,
    });
    expect(agentRoutineWhen(parseRoutineSchedule("every 15 minutes"))).toEqual({
      kind: "cron",
      cron: "*/15 * * * *",
    });
    expect(
      agentRoutineWhen(parseRoutineSchedule("every weekday at 09:00")),
    ).toEqual({
      kind: "cron",
      cron: "0 9 * * 1-5",
    });
    expect(
      agentRoutineWhen(parseRoutineSchedule("every week on monday at 08:30")),
    ).toEqual({
      kind: "cron",
      cron: "30 8 * * 1",
    });
  });

  it("shifts wall-clock times into UTC for the given zone", () => {
    const winter = new Date("2024-01-15T12:00:00Z");
    const summer = new Date("2024-07-15T12:00:00Z");
    expect(
      wallClockToUtcCron("every day at 09:00", "America/New_York", winter),
    ).toBe("0 14 * * *");
    expect(
      wallClockToUtcCron("every day at 09:00", "America/New_York", summer),
    ).toBe("0 13 * * *");
    expect(
      wallClockToUtcCron(
        "every weekday at 22:00",
        "America/Los_Angeles",
        winter,
      ),
    ).toBe("0 6 * * 2,3,4,5,6");
    expect(
      wallClockToUtcCron(
        "every week on sunday at 22:00",
        "America/New_York",
        winter,
      ),
    ).toBe("0 3 * * 1");
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
