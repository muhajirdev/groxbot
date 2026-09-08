/** Pi coding-agent truncation: line cap or byte cap, whichever hits first. */

export const TOOL_TRUNCATE_MAX_LINES = 2000;
export const TOOL_TRUNCATE_MAX_BYTES = 50 * 1024;
export const GREP_MAX_LINE_LENGTH = 500;

const encoder = new TextEncoder();

export type TruncationRetain = "head" | "tail";

export type TruncationResult = {
  content: string;
  truncated: boolean;
  truncatedBy: "lines" | "bytes" | null;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  firstLineExceedsLimit: boolean;
  lastLinePartial: boolean;
  maxLines: number;
  maxBytes: number;
};

export function utf8ByteLength(content: string): number {
  return encoder.encode(content).byteLength;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function splitLines(content: string): string[] {
  if (content.length === 0) return [];
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();
  return lines;
}

export function truncateHead(
  content: string,
  options?: { maxLines?: number; maxBytes?: number },
): TruncationResult {
  const maxLines = options?.maxLines ?? TOOL_TRUNCATE_MAX_LINES;
  const maxBytes = options?.maxBytes ?? TOOL_TRUNCATE_MAX_BYTES;
  const totalBytes = utf8ByteLength(content);
  const lines = splitLines(content);
  const totalLines = lines.length;
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      firstLineExceedsLimit: false,
      lastLinePartial: false,
      maxLines,
      maxBytes,
    };
  }
  const first = lines[0] ?? "";
  if (utf8ByteLength(first) > maxBytes) {
    return {
      content: "",
      truncated: true,
      truncatedBy: "bytes",
      totalLines,
      totalBytes,
      outputLines: 0,
      outputBytes: 0,
      firstLineExceedsLimit: true,
      lastLinePartial: false,
      maxLines,
      maxBytes,
    };
  }
  const kept: string[] = [];
  let outputBytes = 0;
  let truncatedBy: "lines" | "bytes" = "lines";
  for (let i = 0; i < lines.length && kept.length < maxLines; i++) {
    const line = lines[i]!;
    const lineBytes = utf8ByteLength(line) + (i > 0 ? 1 : 0);
    if (outputBytes + lineBytes > maxBytes) {
      truncatedBy = "bytes";
      break;
    }
    kept.push(line);
    outputBytes += lineBytes;
  }
  const output = kept.join("\n");
  return {
    content: output,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: kept.length,
    outputBytes: utf8ByteLength(output),
    firstLineExceedsLimit: false,
    lastLinePartial: false,
    maxLines,
    maxBytes,
  };
}

export function truncateTail(
  content: string,
  options?: { maxLines?: number; maxBytes?: number },
): TruncationResult {
  const maxLines = options?.maxLines ?? TOOL_TRUNCATE_MAX_LINES;
  const maxBytes = options?.maxBytes ?? TOOL_TRUNCATE_MAX_BYTES;
  const totalBytes = utf8ByteLength(content);
  const lines = splitLines(content);
  const totalLines = lines.length;
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      firstLineExceedsLimit: false,
      lastLinePartial: false,
      maxLines,
      maxBytes,
    };
  }
  const kept: string[] = [];
  let outputBytes = 0;
  let truncatedBy: "lines" | "bytes" = "lines";
  let lastLinePartial = false;
  for (let i = lines.length - 1; i >= 0 && kept.length < maxLines; i--) {
    const line = lines[i]!;
    const lineBytes = utf8ByteLength(line) + (kept.length > 0 ? 1 : 0);
    if (outputBytes + lineBytes > maxBytes) {
      truncatedBy = "bytes";
      if (kept.length === 0) {
        const partial = truncateStringFromEnd(line, maxBytes);
        kept.unshift(partial);
        outputBytes = utf8ByteLength(partial);
        lastLinePartial = true;
      }
      break;
    }
    kept.unshift(line);
    outputBytes += lineBytes;
  }
  const output = kept.join("\n");
  return {
    content: output,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: kept.length,
    outputBytes: utf8ByteLength(output),
    firstLineExceedsLimit: false,
    lastLinePartial,
    maxLines,
    maxBytes,
  };
}

function truncateStringFromEnd(str: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const bytes = encoder.encode(str);
  if (bytes.byteLength <= maxBytes) return str;
  let start = bytes.byteLength - maxBytes;
  while (start < bytes.byteLength && (bytes[start]! & 0b1100_0000) === 0b1000_0000) {
    start += 1;
  }
  return new TextDecoder().decode(bytes.subarray(start));
}

export function truncateLine(
  line: string,
  maxChars = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } {
  if (line.length <= maxChars) return { text: line, wasTruncated: false };
  return { text: `${line.slice(0, maxChars)}... [truncated]`, wasTruncated: true };
}

/** Keep the start and a tail so pagination footers / errors survive a char cap. */
export function clipKeepTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 0) return "";
  const hint = `\n[truncated ${text.length} chars. Tail kept.]\n`;
  if (hint.length >= maxChars) return text.slice(0, maxChars);
  const room = maxChars - hint.length;
  const tail = Math.min(Math.floor(room / 4), 400);
  const head = Math.max(0, room - tail);
  return `${text.slice(0, head)}${hint}${text.slice(text.length - tail)}`;
}
