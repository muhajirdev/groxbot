import { describe, expect, it } from "vitest";
import {
  composeRoutineSchedule,
  formatRoutineClock,
  formatRoutineScheduleLabel,
  formatRoutineWhen,
  kindFromRoutineSchedule,
  resolveRoutineTimezone,
  routineClockOptions,
} from "./routine-schedule";

describe("routineClockOptions", () => {
  it("lists 15-minute steps", () => {
    const clocks = routineClockOptions();
    expect(clocks[0]).toBe("00:00");
    expect(clocks).toContain("00:30");
    expect(clocks).toContain("09:00");
    expect(clocks.at(-1)).toBe("23:45");
    expect(clocks).toHaveLength(96);
  });
});

describe("formatRoutineClock", () => {
  it("prints 12-hour times", () => {
    expect(formatRoutineClock("00:30")).toBe("12:30 AM");
    expect(formatRoutineClock("09:00")).toBe("9:00 AM");
    expect(formatRoutineClock("12:00")).toBe("12:00 PM");
    expect(formatRoutineClock("21:15")).toBe("9:15 PM");
  });
});

describe("composeRoutineSchedule", () => {
  it("builds office schedule strings", () => {
    expect(
      composeRoutineSchedule({
        kind: "day",
        time: "9:00 AM",
        weekday: "monday",
        interval: "every 30 minutes",
        advanced: "",
      }),
    ).toBe("every day at 09:00");
    expect(
      composeRoutineSchedule({
        kind: "week",
        time: "21:00",
        weekday: "monday",
        interval: "every 30 minutes",
        advanced: "",
      }),
    ).toBe("every week on monday at 21:00");
  });
});

describe("formatRoutineWhen", () => {
  it("shows timezone on wall-clock jobs", () => {
    expect(formatRoutineScheduleLabel("every day at 09:00")).toBe(
      "Every day at 9:00 AM",
    );
    expect(kindFromRoutineSchedule("every weekday at 09:00")).toBe("weekday");
    expect(formatRoutineWhen("every day at 09:00", "Asia/Jakarta")).toBe(
      "Every day at 9:00 AM · Asia/Jakarta",
    );
    expect(formatRoutineWhen("every 30 minutes", "Asia/Jakarta")).toBe(
      "Every 30 minutes",
    );
  });

  it("resolves auto-detect vs an explicit zone", () => {
    expect(resolveRoutineTimezone("auto", "Asia/Jakarta")).toBe("Asia/Jakarta");
    expect(resolveRoutineTimezone("America/New_York", "Asia/Jakarta")).toBe(
      "America/New_York",
    );
  });
});
