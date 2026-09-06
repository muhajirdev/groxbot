import { describe, expect, it } from "vitest";
import { formatDaySep, messageDaySep } from "./time";

describe("messageDaySep", () => {
  const morning = new Date(2026, 8, 5, 10, 14).getTime();
  const afternoon = new Date(2026, 8, 5, 15, 2).getTime();
  const nextMorning = new Date(2026, 8, 6, 9, 0).getTime();

  it("hides when the stamp is missing or epoch", () => {
    expect(messageDaySep(undefined)).toBe("");
    expect(messageDaySep(0)).toBe("");
    expect(messageDaySep(new Date(0))).toBe("");
  });

  it("labels the first stamp in a thread", () => {
    expect(messageDaySep(morning)).toBe(
      formatDaySep(new Date(morning).toISOString()),
    );
  });

  it("stays quiet for a close follow-up on the same day", () => {
    const soon = morning + 20 * 60 * 1000;
    expect(messageDaySep(soon, morning)).toBe("");
  });

  it("repeats the clock after a long same-day gap", () => {
    expect(messageDaySep(afternoon, morning)).toBe(
      new Date(afternoon).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  });

  it("starts a new day header on the next calendar day", () => {
    expect(messageDaySep(nextMorning, afternoon)).toBe(
      formatDaySep(new Date(nextMorning).toISOString()),
    );
  });
});
