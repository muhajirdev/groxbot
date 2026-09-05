import { describe, expect, it } from "vitest";
import {
  computerSecondsToMinutes,
  isComputerMeterTool,
} from "./computer-usage.js";

describe("computer usage helpers", () => {
  it("recognizes computer tools", () => {
    expect(isComputerMeterTool("shell")).toBe(true);
    expect(isComputerMeterTool("list")).toBe(true);
    expect(isComputerMeterTool("code")).toBe(false);
    expect(isComputerMeterTool("present")).toBe(false);
  });

  it("rounds seconds up to minutes for display", () => {
    expect(computerSecondsToMinutes(0)).toBe(0);
    expect(computerSecondsToMinutes(1)).toBe(1);
    expect(computerSecondsToMinutes(60)).toBe(1);
    expect(computerSecondsToMinutes(61)).toBe(2);
  });
});
