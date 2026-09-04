/**
 * Fold Pi assistant + toolResult messages into one UI bubble.
 * Browser-safe; no `@earendil-works/*` and no React.
 */

import {
  isOfficeReviewSkip,
  isOfficeReviewUserMessage,
  presentPreviewFromParts,
} from "@groxbot/contracts";
import type {
  PiAgentMessage,
  PiAssistantMessage,
  PiBoundMessage,
  PiOfficeView,
  PiToolExecution,
  PiToolResultMessage,
  PiUserMessage,
} from "./pi-transcript.js";
import { piUserText, piViewMessages } from "./pi-transcript.js";
import { roomSpeakerKey } from "./room-speaker.js";

export type PiProjectedPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "image"; image: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      argsText: string;
      result?: unknown;
      isError?: boolean;
    };

export type PiProjectedMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: PiProjectedPart[];
  createdAt?: number;
  status?: { type: string; reason?: string; error?: string };
  metadata?: { custom?: Record<string, unknown> };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function createdAtOf(message: { timestamp?: number }): number | undefined {
  return typeof message.timestamp === "number" ? message.timestamp : undefined;
}

function extractResultText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value == null) return undefined;
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
  const text = content
    .filter(
      (part): part is { type: "text"; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("");
  return text;
}

function projectedMeta(metadata: unknown): PiProjectedMessage["metadata"] {
  const row = asRecord(metadata);
  if (!row) return undefined;
  const custom = asRecord(row.custom);
  return { custom: { ...row, ...custom } };
}

function buildToolResultMap(messages: readonly PiBoundMessage[]) {
  const map = new Map<
    string,
    { result: unknown; isError: boolean }
  >();
  for (const row of messages) {
    if (row.message.role !== "toolResult") continue;
    const message = row.message as PiToolResultMessage;
    map.set(message.toolCallId, {
      result:
        extractResultText({ content: message.content }) ?? message.details,
      isError: Boolean(message.isError),
    });
  }
  return map;
}

function projectUserContent(content: PiUserMessage["content"]): PiProjectedPart[] {
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content }] : [];
  }
  return content.map((part) => {
    if (part.type === "image") {
      const image = /^data:/i.test(part.data)
        ? part.data
        : `data:${part.mimeType};base64,${part.data}`;
      return { type: "image" as const, image };
    }
    return { type: "text" as const, text: part.text };
  });
}

export function projectPiBoundMessages(
  messages: readonly PiBoundMessage[],
  toolExecutions: Record<string, PiToolExecution> = {},
  runStatus: "idle" | "running" = "idle",
): PiProjectedMessage[] {
  const toolResults = buildToolResultMap(messages);
  const out: PiProjectedMessage[] = [];
  let group: {
    id: string;
    parts: PiProjectedPart[];
    last: PiAssistantMessage;
    createdAt?: number;
    metadata?: unknown;
  } | null = null;

  const flush = (isLast: boolean) => {
    if (!group) return;
    const last = group.last;
    let status: PiProjectedMessage["status"];
    if (
      runStatus === "running" &&
      isLast &&
      last.stopReason !== "error" &&
      last.stopReason !== "aborted"
    ) {
      status = { type: "running" };
    } else if (last.stopReason === "error") {
      status = {
        type: "incomplete",
        reason: "error",
        ...(last.errorMessage ? { error: last.errorMessage } : {}),
      };
    } else if (last.stopReason === "aborted") {
      status = { type: "incomplete", reason: "cancelled" };
    } else {
      status = { type: "complete", reason: "stop" };
    }
    out.push({
      id: group.id,
      role: "assistant",
      content: group.parts,
      createdAt: group.createdAt,
      status,
      metadata: projectedMeta(group.metadata),
    });
    group = null;
  };

  messages.forEach((row, index) => {
    const isLast = index === messages.length - 1;
    const message = row.message;
    if (message.role === "assistant") {
      const assistant = message as PiAssistantMessage;
      if (
        group &&
        roomSpeakerKey(group.metadata) !== roomSpeakerKey(row.metadata)
      ) {
        flush(false);
      }
      if (!group) {
        group = {
          id: row.id,
          parts: [],
          last: assistant,
          createdAt: createdAtOf(assistant),
          metadata: row.metadata,
        };
      }
      group.last = assistant;
      const content = Array.isArray(assistant.content) ? assistant.content : [];
      for (const part of content) {
        if (part.type === "text") {
          group.parts.push({ type: "text", text: part.text });
        } else if (part.type === "thinking") {
          group.parts.push({
            type: "reasoning",
            text: part.thinking || (part.redacted ? "[reasoning redacted]" : ""),
          });
        } else if (part.type === "toolCall") {
          const paired = toolResults.get(part.id);
          const live = toolExecutions[part.id];
          const result =
            paired?.result ??
            (live
              ? extractResultText(live.partialResult) ?? live.result
              : undefined);
          const isError = paired?.isError ?? live?.status === "error";
          const args = (part.arguments ?? {}) as Record<string, unknown>;
          const toolCall: PiProjectedPart = {
            type: "tool-call",
            toolCallId: part.id,
            toolName: part.name,
            args,
            argsText: JSON.stringify(args),
            ...(result !== undefined ? { result } : {}),
            ...(isError ? { isError: true } : {}),
          };
          group.parts.push(toolCall);
        }
      }
      if (isLast) flush(true);
      return;
    }
    if (message.role === "toolResult") return;
    flush(false);
    if (message.role === "user") {
      const user = message as PiUserMessage;
      out.push({
        id: row.id,
        role: "user",
        content: projectUserContent(user.content),
        createdAt: createdAtOf(user),
        metadata: projectedMeta(row.metadata),
      });
    }
  });
  flush(true);
  return out;
}

export function projectPiOfficeView(view: PiOfficeView): PiProjectedMessage[] {
  const running =
    view.status === "submitted" || view.status === "streaming"
      ? "running"
      : "idle";
  return projectPiBoundMessages(
    piViewMessages(view),
    view.toolExecutions,
    running,
  );
}

export function projectedText(message: PiProjectedMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

const FILE_NOTE = "On this computer:";

function isComputerFileNote(text: string): boolean {
  return (
    text.startsWith(`${FILE_NOTE} `) ||
    /^Saved on this computer as \S/u.test(text)
  );
}

function visibleText(message: PiProjectedMessage): string {
  return message.content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .filter((text) => !isComputerFileNote(text))
    .join("");
}

export function usedProjectedTools(message: PiProjectedMessage): boolean {
  return message.content.some((part) => part.type === "tool-call");
}

export function isVisibleProjectedMessage(message: PiProjectedMessage): boolean {
  if (isOfficeReviewUserMessage({ role: message.role, metadata: message.metadata })) {
    return false;
  }
  if (message.role === "assistant" && isOfficeReviewSkip(projectedText(message))) {
    return false;
  }
  if (message.role === "user") {
    return (
      visibleText(message).trim().length > 0 ||
      message.content.some((part) => part.type === "image")
    );
  }
  return projectedText(message).length > 0 || usedProjectedTools(message);
}

export function lastProjectedPreview(messages: readonly PiProjectedMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row || !isVisibleProjectedMessage(row)) continue;
    const text = visibleText(row).replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 140);
    const presented = presentPreviewFromParts(row.content);
    if (presented) return presented;
  }
  return "";
}

export function splitQueuedProjectedFollowUps(
  messages: PiProjectedMessage[],
  busy: boolean,
): { thread: PiProjectedMessage[]; queued: PiProjectedMessage[] } {
  if (!busy) return { thread: messages, queued: [] };

  let lastAssistant = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") {
      lastAssistant = i;
      break;
    }
  }

  if (lastAssistant < 0) {
    let firstUser = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role !== "user") {
        firstUser = i + 1;
        break;
      }
      if (i === 0) firstUser = 0;
    }
    if (firstUser < 0 || firstUser >= messages.length - 1) {
      return { thread: messages, queued: [] };
    }
    return {
      thread: messages.slice(0, firstUser + 1),
      queued: messages.slice(firstUser + 1),
    };
  }

  const trailing = messages
    .slice(lastAssistant + 1)
    .filter((message) => message.role === "user");
  const usersBefore: PiProjectedMessage[] = [];
  let cursor = lastAssistant - 1;
  while (cursor >= 0 && messages[cursor]?.role === "user") {
    usersBefore.unshift(messages[cursor]!);
    cursor -= 1;
  }
  const prompt = usersBefore[0];
  const queued = [...usersBefore.slice(1), ...trailing];
  const thread = [
    ...messages.slice(0, cursor + 1),
    ...(prompt ? [prompt] : []),
    messages[lastAssistant]!,
  ];
  return { thread, queued };
}

export function coalesceProjectedAssistants(
  messages: PiProjectedMessage[],
): PiProjectedMessage[] {
  const out: PiProjectedMessage[] = [];
  for (const message of messages) {
    const prev = out.at(-1);
    if (prev?.role === "assistant" && message.role === "assistant") {
      const prevText = projectedText(prev);
      const nextText = projectedText(message);
      if (prevText && nextText && nextText.includes(prevText)) {
        out[out.length - 1] = message;
        continue;
      }
      if (prevText && nextText && prevText.includes(nextText)) continue;
    }
    out.push(message);
  }
  return out;
}

export function userBoundFromText(input: {
  id: string;
  content: string;
  metadata?: unknown;
}): PiBoundMessage {
  return {
    id: input.id,
    metadata: input.metadata,
    message: {
      role: "user",
      content: input.content,
      timestamp: Date.now(),
    },
  };
}

export function textFromPiAgentMessage(message: PiAgentMessage): string {
  if (message.role === "user") return piUserText(message);
  if (message.role !== "assistant" || !Array.isArray(message.content)) return "";
  return message.content
    .flatMap((part) =>
      part.type === "text" && part.text ? [part.text] : [],
    )
    .join("");
}
