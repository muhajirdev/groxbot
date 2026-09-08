import { describe, expect, it, vi } from "vitest";
import { COMPUTER_SHELL_SPILL_PATH } from "./computer-fs.js";
import { shapeComputerToolResult } from "./computer-tool-result.js";

describe("shapeComputerToolResult", () => {
  it("turns a truncated CF read into Pi offset text", async () => {
    const shaped = await shapeComputerToolResult("read", {}, {
      path: "/workspace/invoice.html",
      content: "<html>",
      startLine: 1,
      endLine: 1,
      totalLines: null,
      truncated: true,
      nextOffset: 2,
      nextByteOffset: 80,
    });
    expect(shaped?.text).toContain("<html>");
    expect(shaped?.text).toMatch(/Use offset=2 to continue/);
    expect(shaped?.text).toContain("byteOffset=80");
    expect(shaped?.retain).toBe("head");
  });

  it("keeps the tail of shell output and spills the rest", async () => {
    const stdout = Array.from({ length: 2100 }, (_, i) => `line-${i + 1}`).join(
      "\n",
    );
    const spill = vi.fn(async () => {});
    const shaped = await shapeComputerToolResult(
      "shell",
      { command: "seq 2100" },
      { command: "seq 2100", exitCode: 0, stdout, stderr: "" },
      { spill },
    );
    expect(shaped?.retain).toBe("tail");
    expect(shaped?.text).toContain("line-2100");
    expect(shaped?.text).not.toContain("line-1\n");
    expect(spill).toHaveBeenCalledWith(COMPUTER_SHELL_SPILL_PATH, stdout);
    expect(shaped?.text).toContain(COMPUTER_SHELL_SPILL_PATH);
  });

  it("throws when the shell exit code is not zero", async () => {
    await expect(
      shapeComputerToolResult("shell", {}, {
        command: "false",
        exitCode: 1,
        stdout: "",
        stderr: "boom",
      }),
    ).rejects.toThrow(/exited with code 1/);
  });

  it("shortens grep match lines and keeps nextOffset", async () => {
    const shaped = await shapeComputerToolResult("grep", {}, {
      path: "/",
      query: "x",
      count: 1,
      nextOffset: 20,
      matches: [{ path: "/workspace/a.md", line: 3, text: "n".repeat(800) }],
    });
    expect(shaped?.text).toMatch(/\/workspace\/a\.md:3:/);
    expect(shaped?.text).toMatch(/\[truncated\]/);
    expect(shaped?.text).toMatch(/offset=20/);
  });
});
