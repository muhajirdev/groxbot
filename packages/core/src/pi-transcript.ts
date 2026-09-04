/** Browser-safe Pi wire types. Do not import `@earendil-works/pi-*` here. */

import { newId } from "./ids.js";
import {
  type OfficeChatMessage,
  officeChatText,
  parseOfficeChatMessages,
  stringifyToolOutput,
  toolNameFromPart,
} from "./office-chat.js";

export type PiTextContent = {
  type: "text";
  text: string;
  textSignature?: string;
};

export type PiThinkingContent = {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
};

export type PiImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type PiToolCall = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
};

export type PiAssistantContent = PiTextContent | PiThinkingContent | PiToolCall;
export type PiUserContent = PiTextContent | PiImageContent;
export type PiToolResultContent = PiTextContent | PiImageContent;

export type PiUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
};

export type PiStopReason = "stop" | "length" | "toolUse" | "error" | "aborted";

export type PiUserMessage = {
  role: "user";
  content: string | PiUserContent[];
  timestamp: number;
};

export type PiAssistantMessage = {
  role: "assistant";
  content: PiAssistantContent[];
  api?: string;
  provider?: string;
  model?: string;
  responseModel?: string;
  responseId?: string;
  usage?: PiUsage;
  stopReason?: PiStopReason;
  errorMessage?: string;
  timestamp: number;
};

export type PiToolResultMessage = {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: PiToolResultContent[];
  details?: unknown;
  isError: boolean;
  timestamp: number;
};

export type PiAgentMessage =
  | PiUserMessage
  | PiAssistantMessage
  | PiToolResultMessage
  | { role: string; timestamp?: number; [key: string]: unknown };

export type PiBoundMessage = {
  id: string;
  message: PiAgentMessage;
  metadata?: unknown;
};

export type PiThreadStatus = "idle" | "running" | "failed";

export type PiOfficeSnapshot = {
  metadata: { id: string; status: PiThreadStatus };
  messages: PiBoundMessage[];
  lastError?: string;
  floorBotId?: string;
};

export type PiSendMessageInput = {
  content: string;
  id?: string;
  metadata?: unknown;
  targetBotId?: string;
};

export type PiToolExecution = {
  status: "running" | "done" | "error";
  toolName?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
};

export type PiOfficeStatus = "ready" | "submitted" | "streaming" | "error";

export type PiOfficeView = {
  threadId: string;
  messages: PiBoundMessage[];
  streaming: PiBoundMessage | null;
  toolExecutions: Record<string, PiToolExecution>;
  status: PiOfficeStatus;
  error: string;
  generation: number;
  seq: number;
  floorBotId: string;
};

export type PiClientEvent = {
  threadId: string;
  seq: number;
  type: string;
  snapshot?: PiOfficeSnapshot;
  message?: PiAgentMessage;
  id?: string;
  metadata?: unknown;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  error?: string;
  willRetry?: boolean;
  turnIndex?: number;
  [key: string]: unknown;
};

const EMPTY_USAGE: PiUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export function emptyPiUsage(): PiUsage {
  return EMPTY_USAGE;
}

export function emptyPiOfficeView(threadId = ""): PiOfficeView {
  return {
    threadId,
    messages: [],
    streaming: null,
    toolExecutions: {},
    status: "ready",
    error: "",
    generation: 0,
    seq: 0,
    floorBotId: "",
  };
}

export function parsePiAgentMessage(value: unknown): PiAgentMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.role !== "string" || !row.role) return null;
  return row as PiAgentMessage;
}

export function parsePiBoundMessage(value: unknown): PiBoundMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const message = parsePiAgentMessage(row.message);
  if (!id || !message) return null;
  const bound: PiBoundMessage = { id, message };
  if (row.metadata !== undefined) bound.metadata = row.metadata;
  return bound;
}

export function parsePiBoundMessages(value: unknown): PiBoundMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = parsePiBoundMessage(row);
    return parsed ? [parsed] : [];
  });
}

/** Accept Pi bound rows, or legacy UIMessage-shaped office/group log JSON. */
export function parsePiLogMessages(value: unknown): PiBoundMessage[] {
  if (!Array.isArray(value)) return [];
  const out: PiBoundMessage[] = [];
  for (const row of value) {
    const bound = parsePiBoundMessage(row);
    if (bound) {
      out.push(bound);
      continue;
    }
    const legacy = parseOfficeChatMessages([row]);
    if (legacy.length) out.push(...officeChatToPiBound(legacy));
  }
  return out;
}

export function parsePiOfficeSnapshot(value: unknown): PiOfficeSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const id = typeof meta?.id === "string" ? meta.id : "";
  const status = meta?.status;
  if (
    !id ||
    (status !== "idle" && status !== "running" && status !== "failed")
  ) {
    return null;
  }
  const snapshot: PiOfficeSnapshot = {
    metadata: { id, status },
    messages: parsePiBoundMessages(row.messages),
  };
  if (typeof row.lastError === "string" && row.lastError) {
    snapshot.lastError = row.lastError;
  }
  if (typeof row.floorBotId === "string" && row.floorBotId.trim()) {
    snapshot.floorBotId = row.floorBotId.trim();
  }
  return snapshot;
}

export function parsePiClientEvent(value: unknown): PiClientEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const threadId = typeof row.threadId === "string" ? row.threadId : "";
  const seq =
    typeof row.seq === "number" && Number.isFinite(row.seq) ? row.seq : -1;
  const type = typeof row.type === "string" ? row.type : "";
  if (!threadId || seq < 0 || !type) return null;
  return row as PiClientEvent;
}

export function parsePiSendMessageInput(
  value: unknown,
): PiSendMessageInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.content !== "string") return null;
  const input: PiSendMessageInput = { content: row.content };
  if (typeof row.id === "string" && row.id.trim()) input.id = row.id.trim();
  if (row.metadata !== undefined) input.metadata = row.metadata;
  if (typeof row.targetBotId === "string" && row.targetBotId.trim()) {
    input.targetBotId = row.targetBotId.trim();
  }
  return input;
}

export function piUserText(message: PiAgentMessage): string {
  if (message.role !== "user") return "";
  const content = (message as PiUserMessage).content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) =>
      part.type === "text" && part.text ? [part.text] : [],
    )
    .join("")
    .trim();
}

export function piAssistantText(message: PiAgentMessage): string {
  if (message.role !== "assistant" || !Array.isArray(message.content)) {
    return "";
  }
  return message.content
    .flatMap((part) =>
      part && typeof part === "object" && part.type === "text" && part.text
        ? [part.text]
        : [],
    )
    .join("")
    .trim();
}

export function lastPiUserText(messages: readonly PiBoundMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row || row.message.role !== "user") continue;
    const text = piUserText(row.message);
    if (text) return text;
  }
  return "";
}

export function lastPiAssistantText(
  messages: readonly PiBoundMessage[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row || row.message.role !== "assistant") continue;
    const text = piAssistantText(row.message);
    if (text) return text;
  }
  return "";
}

export function piLogShouldRun(messages: readonly PiBoundMessage[]): boolean {
  return messages.at(-1)?.message.role === "user";
}

export function piLoopMessages(
  messages: readonly PiBoundMessage[],
): PiAgentMessage[] {
  return messages
    .map((row) => row.message)
    .filter(
      (message) =>
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "toolResult",
    );
}

export function piViewMessages(view: PiOfficeView): PiBoundMessage[] {
  const streaming = view.streaming;
  if (!streaming) return view.messages;
  if (view.messages.some((row) => row.id === streaming.id)) {
    return view.messages.map((row) =>
      row.id === streaming.id ? streaming : row,
    );
  }
  return [...view.messages, streaming];
}

export function upsertPiBoundMessage(
  messages: readonly PiBoundMessage[],
  next: PiBoundMessage,
): PiBoundMessage[] {
  const index = messages.findIndex((row) => row.id === next.id);
  if (index < 0) return [...messages, next];
  const copy = messages.slice();
  copy[index] = next;
  return copy;
}

export type PiAssistantDraft = { id?: string };

/** Stable id for one assistant bubble. Reset after that message ends so the next tool round does not share it. */
export function takePiAssistantDraft(
  draft: PiAssistantDraft,
  event: { type: string; message?: { role?: string } },
): string | undefined {
  const assistant =
    event.message?.role === "assistant" &&
    (event.type === "message_start" ||
      event.type === "message_update" ||
      event.type === "message_end");
  if (!assistant) return undefined;
  if (!draft.id) draft.id = newId();
  const id = draft.id;
  if (event.type === "message_end") draft.id = undefined;
  return id;
}

export function applyPiOfficeEvent(
  view: PiOfficeView,
  event: PiClientEvent,
): PiOfficeView {
  if (event.seq < view.seq) return view;
  const next: PiOfficeView = {
    ...view,
    threadId: event.threadId || view.threadId,
    seq: event.seq,
    toolExecutions: { ...view.toolExecutions },
  };
  switch (event.type) {
    case "snapshot": {
      const snapshot = event.snapshot
        ? parsePiOfficeSnapshot(event.snapshot)
        : null;
      if (!snapshot) return next;
      next.messages = snapshot.messages;
      next.streaming = null;
      next.toolExecutions = {};
      next.error = snapshot.lastError ?? "";
      next.floorBotId = snapshot.floorBotId ?? "";
      next.status =
        snapshot.metadata.status === "failed"
          ? "error"
          : snapshot.metadata.status === "running"
            ? next.status === "ready"
              ? "submitted"
              : next.status
            : "ready";
      return next;
    }
    case "message_update": {
      const message = event.message ? parsePiAgentMessage(event.message) : null;
      if (!message) return next;
      const id =
        (typeof event.id === "string" && event.id) ||
        next.streaming?.id ||
        "stream";
      next.streaming = { id, message, metadata: event.metadata };
      return next;
    }
    case "message_end":
    case "message_start": {
      const message = event.message ? parsePiAgentMessage(event.message) : null;
      if (!message) return next;
      const id =
        (typeof event.id === "string" && event.id) ||
        `${message.role}-${event.seq}`;
      const row: PiBoundMessage = { id, message };
      if (event.metadata !== undefined) row.metadata = event.metadata;
      next.messages = upsertPiBoundMessage(next.messages, row);
      // Always drop the overlay. A later tool round has no draft id, so
      // message_end would otherwise leave `streaming` beside the commit and
      // the UI would fold two tool-call parts with the same toolCallId.
      next.streaming = null;
      return next;
    }
    case "tool_execution_start": {
      if (typeof event.toolCallId !== "string" || !event.toolCallId) return next;
      next.toolExecutions[event.toolCallId] = {
        status: "running",
        toolName:
          typeof event.toolName === "string" ? event.toolName : undefined,
        args: event.args,
      };
      return next;
    }
    case "tool_execution_update": {
      if (typeof event.toolCallId !== "string" || !event.toolCallId) return next;
      const current = next.toolExecutions[event.toolCallId] ?? {
        status: "running" as const,
      };
      next.toolExecutions[event.toolCallId] = {
        ...current,
        status: "running",
        partialResult: event.partialResult,
      };
      return next;
    }
    case "tool_execution_end": {
      if (typeof event.toolCallId !== "string" || !event.toolCallId) return next;
      const current = next.toolExecutions[event.toolCallId] ?? {
        status: "done" as const,
      };
      next.toolExecutions[event.toolCallId] = {
        ...current,
        status: event.isError ? "error" : "done",
        result: event.result,
        isError: Boolean(event.isError),
      };
      return next;
    }
    case "error": {
      if (typeof event.error === "string" && event.error) {
        next.error = event.error;
        next.status = "error";
      }
      return next;
    }
    case "floor": {
      next.floorBotId =
        typeof event.botId === "string" ? event.botId.trim() : "";
      return next;
    }
    default:
      return next;
  }
}

export function countPiToolCallsSinceLastUser(
  messages: readonly PiBoundMessage[],
): number {
  let start = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.message.role === "user") start = i + 1;
  }
  let n = 0;
  for (const row of messages.slice(start)) {
    const message = row.message;
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }
    for (const part of message.content) {
      if (part && typeof part === "object" && part.type === "toolCall") n += 1;
    }
  }
  return n;
}

export function piAssistantTurnSettled(
  messages: readonly PiBoundMessage[],
): boolean {
  const last = messages.at(-1)?.message;
  if (!last) return true;
  if (last.role === "toolResult") return false;
  if (last.role === "assistant") {
    return (last as PiAssistantMessage).stopReason !== "toolUse";
  }
  return true;
}

export function officeChatToPiBound(
  rows: readonly OfficeChatMessage[],
): PiBoundMessage[] {
  const out: PiBoundMessage[] = [];
  for (const row of rows) {
    const timestamp = row.createdAt ?? 0;
    if (row.role === "user") {
      const bound: PiBoundMessage = {
        id: row.id,
        message: {
          role: "user",
          content: officeChatText(row),
          timestamp,
        },
      };
      if (row.metadata !== undefined) bound.metadata = row.metadata;
      out.push(bound);
      continue;
    }
    if (row.role !== "assistant") continue;
    const content: PiAssistantContent[] = [];
    const results: PiBoundMessage[] = [];
    for (const part of row.parts) {
      if (part.type === "text" && typeof part.text === "string" && part.text) {
        content.push({ type: "text", text: part.text });
      }
      const name = toolNameFromPart(part);
      const toolCallId =
        typeof part.toolCallId === "string" ? part.toolCallId : "";
      if (!name || !toolCallId) continue;
      const args =
        part.input && typeof part.input === "object" && !Array.isArray(part.input)
          ? (part.input as Record<string, unknown>)
          : {};
      content.push({ type: "toolCall", id: toolCallId, name, arguments: args });
      if (part.state !== "output-available" && part.state !== "output-error") {
        continue;
      }
      results.push({
        id: `${row.id}:${toolCallId}`,
        message: {
          role: "toolResult",
          toolCallId,
          toolName: name,
          content: [{ type: "text", text: stringifyToolOutput(part.output) }],
          details: part.output,
          isError: part.state === "output-error",
          timestamp,
        },
      });
    }
    out.push({
      id: row.id,
      message: {
        role: "assistant",
        content,
        api: "openai-completions",
        provider: "office",
        model: "migrated",
        usage: EMPTY_USAGE,
        stopReason: results.length ? "toolUse" : "stop",
        timestamp,
      },
    });
    out.push(...results);
  }
  return out;
}
