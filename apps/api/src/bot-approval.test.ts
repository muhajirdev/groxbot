import { describe, expect, it } from "vitest";
import { OFFICE_APPROVAL_REJECTED } from "@groxbot/core";
import { OfficeApprovalBoard } from "./bot-approval.js";

describe("OfficeApprovalBoard", () => {
  it("parks until resume", async () => {
    const board = new OfficeApprovalBoard();
    const pending = board.wait("exec_1");
    expect(board.isWaiting("exec_1")).toBe(true);
    expect(board.resume("exec_1", { status: "completed", result: { id: "bot_1" } })).toBe(
      true,
    );
    await expect(pending).resolves.toMatchObject({
      status: "completed",
      result: { id: "bot_1" },
    });
    expect(board.isWaiting("exec_1")).toBe(false);
  });

  it("returns a late approve if wait is not registered yet", async () => {
    const board = new OfficeApprovalBoard();
    expect(board.resume("exec_2", { status: "completed" })).toBe(false);
    await expect(board.wait("exec_2")).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("rejects with a model-facing payload", async () => {
    const board = new OfficeApprovalBoard();
    const pending = board.wait("exec_3");
    expect(board.reject("exec_3")).toBe(true);
    await expect(pending).resolves.toEqual(OFFICE_APPROVAL_REJECTED);
  });

  it("returns paused when the turn aborts so Code Mode can stay pending", async () => {
    const board = new OfficeApprovalBoard();
    const abort = new AbortController();
    const pending = board.wait("exec_4", abort.signal);
    abort.abort();
    await expect(pending).resolves.toMatchObject({
      status: "paused",
      executionId: "exec_4",
    });
  });
});
