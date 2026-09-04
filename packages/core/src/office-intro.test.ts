import { OFFICE_INTRO_SOURCE, OFFICE_REVIEW_SOURCE } from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import {
  lastOfficeUserIsIntro,
  officeIntroTurnTools,
  officeIntroUserMessage,
  officeIntroUserText,
  officeIntroWho,
  shouldRunOfficeIntro,
} from "./office-intro.js";
import { OFFICE_SET_CONTEXT_TOOL_NAME } from "./office-system-prompt.js";

describe("office intro identity", () => {
  it("uses a hire name as the person to become", () => {
    expect(officeIntroWho({ name: "Alex Hormozi" })).toBe("Alex Hormozi");
    const text = officeIntroUserText({ name: "Alex Hormozi" });
    expect(text).toMatch(/hired as Alex Hormozi/);
    expect(text).toMatch(/call the set_context tool/);
    expect(text).toMatch(/label soul/);
    expect(text).toMatch(/known name/);
    expect(text).toMatch(/role, a personality/);
    expect(text).not.toMatch(/Skip/);
    expect(text).not.toMatch(/No other tools/);
  });

  it("uses a job name as the role to become", () => {
    const text = officeIntroUserText({ name: "Chief of Staff" });
    expect(text).toMatch(/hired as Chief of Staff/);
    expect(text).toMatch(/inhabit that job/);
  });

  it("tags the nudge so the thread can hide it", () => {
    const msg = officeIntroUserMessage({ name: "Alex Hormozi" });
    expect(msg.metadata.source).toBe(OFFICE_INTRO_SOURCE);
    expect(msg.metadata.custom.source).toBe(OFFICE_INTRO_SOURCE);
  });
});

describe("shouldRunOfficeIntro", () => {
  it("runs on an empty desk", () => {
    expect(shouldRunOfficeIntro([])).toBe(true);
  });

  it("skips after a real human turn", () => {
    expect(
      shouldRunOfficeIntro([{ role: "user", metadata: { user: { name: "Sam" } } }]),
    ).toBe(false);
  });

  it("skips when an intro kick is already in the log", () => {
    expect(
      shouldRunOfficeIntro([
        {
          role: "user",
          metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
        },
      ]),
    ).toBe(false);
  });

  it("skips after the teammate already spoke", () => {
    expect(shouldRunOfficeIntro([{ role: "assistant" }])).toBe(false);
    expect(
      shouldRunOfficeIntro([{ message: { role: "assistant" } }]),
    ).toBe(false);
  });

  it("ignores a leftover office-review user on an otherwise empty desk", () => {
    expect(
      shouldRunOfficeIntro([
        {
          role: "user",
          metadata: { custom: { source: OFFICE_REVIEW_SOURCE } },
        },
      ]),
    ).toBe(true);
  });
});

describe("lastOfficeUserIsIntro", () => {
  it("reads the last user in the Pi window", () => {
    expect(
      lastOfficeUserIsIntro([
        {
          message: { role: "user" },
          metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
        },
      ]),
    ).toBe(true);
    expect(
      lastOfficeUserIsIntro([
        {
          message: { role: "user" },
          metadata: { custom: { source: OFFICE_INTRO_SOURCE } },
        },
        { message: { role: "user" }, metadata: { user: { name: "Sam" } } },
      ]),
    ).toBe(false);
  });
});

describe("officeIntroTurnTools", () => {
  it("keeps only set_context when that tool is on the catalog", () => {
    expect(
      officeIntroTurnTools([
        { name: "code" },
        { name: OFFICE_SET_CONTEXT_TOOL_NAME },
        { name: "shell" },
      ]),
    ).toEqual([{ name: OFFICE_SET_CONTEXT_TOOL_NAME }]);
  });

  it("keeps the full catalog if set_context is missing", () => {
    const tools = [{ name: "code" }, { name: "shell" }];
    expect(officeIntroTurnTools(tools)).toEqual(tools);
  });
});
