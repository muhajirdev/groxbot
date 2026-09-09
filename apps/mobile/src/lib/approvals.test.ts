import { describe, expect, it } from "vitest";
import { approvalSummary, parsePendingApprovals } from "./approvals";

describe("parsePendingApprovals", () => {
  it("keeps well-formed hire actions", () => {
    const rows = parsePendingApprovals([
      {
        executionId: "ex-1",
        seq: 3,
        connector: "bots",
        method: "hire",
        args: { name: "Piper", title: "Scout" },
      },
      { executionId: "bad" },
    ]);
    expect(rows).toHaveLength(1);
    expect(approvalSummary(rows[0]!)).toBe("Hire Piper — Scout");
  });

  it("falls back to connector.method", () => {
    expect(
      approvalSummary({
        executionId: "ex",
        seq: 1,
        connector: "mail",
        method: "send",
        args: {},
      }),
    ).toBe("mail.send");
  });
});
