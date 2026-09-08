/** Shape CF computer tool dumps the way Pi's coding-agent harness does. */

import {
  COMPUTER_SHELL_SPILL_PATH,
  computerRelativePath,
} from "./computer-fs.js";
import {
  clipKeepTail,
  formatSize,
  TOOL_TRUNCATE_MAX_BYTES,
  truncateHead,
  truncateLine,
  truncateTail,
  type TruncationRetain,
} from "./tool-truncate.js";

export const TOOL_FILE_MAX_CHARS = TOOL_TRUNCATE_MAX_BYTES;

export type ComputerToolSpill = (
  path: string,
  content: string,
) => Promise<void>;

export type ShapedComputerTool = {
  text: string;
  retain: TruncationRetain;
  details: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function shapeComputerToolResult(
  name: string,
  args: Record<string, unknown>,
  result: unknown,
  opts?: { spill?: ComputerToolSpill },
): Promise<ShapedComputerTool | null> {
  if (name === "read") return shapeRead(args, result);
  if (name === "shell") return shapeShell(result, opts?.spill);
  if (name === "grep") return shapeGrep(result);
  if (name === "list" || name === "find") return shapePaged(result);
  return null;
}

function shapeRead(
  args: Record<string, unknown>,
  result: unknown,
): ShapedComputerTool | null {
  const row = asRecord(result);
  if (!row || typeof row.content !== "string") return null;
  const content = row.content;
  const startLine = num(row.startLine) ?? num(args.offset) ?? 1;
  const endLine =
    num(row.endLine) ?? startLine + Math.max(0, content.split("\n").length) - 1;
  const nextOffset = num(row.nextOffset);
  const nextByteOffset = num(row.nextByteOffset);
  const totalLines = num(row.totalLines);
  const truncated = row.truncated === true;
  const head = truncateHead(content);
  if (head.firstLineExceedsLimit) {
    const path =
      typeof row.path === "string" ? computerRelativePath(row.path) : "file";
    return {
      text: `[Line ${startLine} exceeds the ${formatSize(TOOL_TRUNCATE_MAX_BYTES)} limit. Use shell: sed -n '${startLine}p' ${path} | head -c ${TOOL_TRUNCATE_MAX_BYTES}]`,
      retain: "head",
      details: { truncation: head },
    };
  }
  let text = head.content;
  if (head.truncated || truncated) {
    const shownEnd = startLine + Math.max(head.outputLines, 1) - 1;
    const continueAt = nextOffset ?? shownEnd + 1;
    const of = totalLines ?? (truncated ? "?" : shownEnd);
    const limitNote =
      head.truncatedBy === "bytes"
        ? ` (${formatSize(TOOL_TRUNCATE_MAX_BYTES)} limit)`
        : "";
    text += `\n\n[Showing lines ${startLine}-${shownEnd} of ${of}${limitNote}. Use offset=${continueAt} to continue.]`;
    if (nextByteOffset !== undefined) {
      text += ` byteOffset=${nextByteOffset}`;
    }
  }
  return {
    text,
    retain: "head",
    details: {
      path: row.path,
      startLine,
      endLine,
      truncated: Boolean(head.truncated || truncated),
      ...(nextOffset !== undefined ? { nextOffset } : {}),
      ...(nextByteOffset !== undefined ? { nextByteOffset } : {}),
    },
  };
}

async function shapeShell(
  result: unknown,
  spill?: ComputerToolSpill,
): Promise<ShapedComputerTool | null> {
  const row = asRecord(result);
  if (!row) return null;
  if (typeof row.error === "string" && row.error.trim()) return null;
  if (!("stdout" in row) && !("stderr" in row) && !("exitCode" in row)) {
    return null;
  }
  const stdout = typeof row.stdout === "string" ? row.stdout : "";
  const stderr = typeof row.stderr === "string" ? row.stderr : "";
  const combined = [stdout, stderr].filter((part) => part.length > 0).join("\n");
  const truncation = truncateTail(combined);
  let text = truncation.content;
  let spillPath: string | undefined;
  if (truncation.truncated) {
    spillPath = COMPUTER_SHELL_SPILL_PATH;
    if (spill) {
      try {
        await spill(spillPath, combined);
      } catch {
        spillPath = undefined;
      }
    }
    const startLine =
      truncation.totalLines - truncation.outputLines + 1;
    const endLine = truncation.totalLines;
    const full = spillPath
      ? ` Full output: ${spillPath}`
      : " Redirect to a file (`> /workspace/out.txt`) and read() it.";
    if (truncation.lastLinePartial) {
      text += `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine}.${full}]`;
    } else if (truncation.truncatedBy === "lines") {
      text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}.${full}]`;
    } else {
      text += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(TOOL_TRUNCATE_MAX_BYTES)} limit).${full}]`;
    }
  }
  const exitCode = num(row.exitCode);
  if (exitCode !== undefined && exitCode !== 0) {
    const status = `Command exited with code ${exitCode}`;
    throw new Error(text ? `${text}\n\n${status}` : status);
  }
  return {
    text: text || "(no output)",
    retain: "tail",
    details: {
      command: row.command,
      cwd: row.cwd,
      exitCode: exitCode ?? 0,
      truncated: truncation.truncated,
      ...(spillPath ? { fullOutputPath: spillPath } : {}),
    },
  };
}

function shapeGrep(result: unknown): ShapedComputerTool | null {
  const row = asRecord(result);
  if (!row || !Array.isArray(row.matches)) return null;
  const matches = row.matches.map((match) => slimGrepMatch(match));
  const nextOffset = num(row.nextOffset);
  const body = matches
    .map((match) => {
      const path = typeof match.path === "string" ? match.path : "";
      const line = num(match.line) ?? "";
      const text = typeof match.text === "string" ? match.text : "";
      return `${path}:${line}:${text}`;
    })
    .join("\n");
  let text = body || "(no matches)";
  if (nextOffset !== undefined) {
    text += `\n\n[${matches.length} matches on this page. Use offset=${nextOffset} to continue.]`;
  }
  const head = truncateHead(text);
  if (head.truncated) {
    text = `${head.content}\n\n[Showing ${head.outputLines} lines of grep. Use a tighter query or offset.]`;
  }
  return {
    text,
    retain: "head",
    details: {
      count: row.count,
      truncated: Boolean(nextOffset !== undefined || head.truncated),
      ...(nextOffset !== undefined ? { nextOffset } : {}),
    },
  };
}

function slimGrepMatch(match: unknown): Record<string, unknown> {
  const row = asRecord(match) ?? {};
  const text = typeof row.text === "string" ? truncateLine(row.text).text : row.text;
  return { ...row, text };
}

function shapePaged(result: unknown): ShapedComputerTool | null {
  const row = asRecord(result);
  if (!row) return null;
  const nextOffset = num(row.nextOffset);
  if (nextOffset === undefined) return null;
  const raw = JSON.stringify(row);
  const clipped = clipKeepTail(raw, TOOL_FILE_MAX_CHARS);
  const suffix = `\n[Use offset=${nextOffset} to continue.]`;
  return {
    text: clipped.includes(`offset=${nextOffset}`)
      ? clipped
      : `${clipped}${suffix}`,
    retain: "head",
    details: { nextOffset, truncated: true },
  };
}
