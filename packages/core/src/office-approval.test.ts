import { describe, expect, it } from "vitest";
import {
  hiredBotFromCodeResult,
  isPausedCodeOutput,
  officeApprovalCopy,
  officeApprovalSummary,
  parseCodeModeOutput,
  parseOfficePendingActions,
} from "./office-approval.js";

const hirePending = {
  executionId: "exec_1",
  seq: 0,
  connector: "bots",
  method: "hire",
  args: {
    name: "CEO",
    title: "Chief Executive Officer",
    instructions: "Set strategic direction.",
  },
};

describe("parseOfficePendingActions", () => {
  it("keeps a Code Mode pending hire", () => {
    expect(parseOfficePendingActions([hirePending])).toEqual([hirePending]);
  });

  it("drops malformed rows", () => {
    expect(parseOfficePendingActions([{ executionId: "x" }])).toEqual([]);
  });
});

describe("parseCodeModeOutput", () => {
  it("reads a paused hire from the tool JSON", () => {
    const paused = {
      status: "paused",
      executionId: "exec_1",
      pending: [hirePending],
    };
    expect(parseCodeModeOutput(JSON.stringify(paused))).toMatchObject({
      status: "paused",
      executionId: "exec_1",
      pending: [hirePending],
    });
    expect(isPausedCodeOutput(paused)).toBe(true);
  });

  it("reads a paused payload from a finished tool content part", () => {
    expect(
      parseCodeModeOutput({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "paused",
              executionId: "exec_9",
              pending: [hirePending],
            }),
          },
        ],
      })?.executionId,
    ).toBe("exec_9");
  });
});

describe("officeApprovalCopy", () => {
  it("names a custom hire", () => {
    expect(officeApprovalCopy(hirePending)).toMatchObject({
      title: "Hire CEO — Chief Executive Officer",
      confirm: "Hire",
      deny: "Don't hire",
    });
  });

  it("fills identity from a marketplace id", () => {
    expect(
      officeApprovalSummary({
        executionId: "exec_2",
        seq: 0,
        connector: "bots",
        method: "hire",
        args: { marketplaceId: "talent-scout" },
      }),
    ).toBe("Hire Talent Scout");
  });

  it("falls back to connector.method", () => {
    expect(
      officeApprovalCopy({
        executionId: "exec_3",
        seq: 1,
        connector: "knowledge",
        method: "remove",
        args: { path: "notes/old.md" },
      }),
    ).toMatchObject({
      title: "Approve knowledge.remove",
      detail: "notes/old.md",
    });
  });
});

describe("hiredBotFromCodeResult", () => {
  it("unwraps a completed Code Mode hire", () => {
    expect(
      hiredBotFromCodeResult({
        status: "completed",
        executionId: "exec_1",
        result: {
          id: "bot_1",
          name: "CEO",
          title: "Chief Executive Officer",
          homeRoomId: "room_1",
          hint: "sidebar",
        },
      }),
    ).toMatchObject({
      id: "bot_1",
      name: "CEO",
      homeRoomId: "room_1",
    });
  });
});
