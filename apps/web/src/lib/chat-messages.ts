import {
  isHiddenOfficeUserMessage,
  isOfficeReviewSkip,
  presentPreviewFromParts,
} from "@groxbot/contracts";
import type { PiProjectedMessage } from "@groxbot/core/browser";
import {
  coalesceProjectedAssistants,
  isVisibleProjectedMessage,
  lastProjectedPreview,
  projectedText,
  splitQueuedProjectedFollowUps,
  usedProjectedTools,
} from "@groxbot/core/browser";
import { isComputerFileNote } from "./computer-attachment";

export function collapseTextParts(
  message: PiProjectedMessage,
): PiProjectedMessage {
  const parts = message.content;
  const textParts = parts.filter((part) => part.type === "text");
  if (textParts.length <= 1) return message;
  const nextParts = parts.filter((part, index) => {
    if (part.type !== "text" || !part.text) return true;
    return !parts.some((candidate, candidateIndex) => {
      if (
        candidateIndex === index ||
        candidate.type !== "text" ||
        !candidate.text
      ) {
        return false;
      }
      return (
        candidate.text.startsWith(part.text) &&
        (candidate.text.length > part.text.length || candidateIndex > index)
      );
    });
  });
  return nextParts.length === parts.length
    ? message
    : { ...message, content: nextParts };
}

export function textFromMessage(message: PiProjectedMessage): string {
  return projectedText(collapseTextParts(message));
}

function visibleTextFromMessage(message: PiProjectedMessage): string {
  return collapseTextParts(message)
    .content.filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .filter((text) => !isComputerFileNote(text))
    .join("");
}

export function lastOfficePreview(messages: PiProjectedMessage[]): string {
  return lastProjectedPreview(messages.map(collapseTextParts));
}

export function usedTools(message: PiProjectedMessage): boolean {
  return usedProjectedTools(message);
}

export function isVisibleChatMessage(message: {
  id?: string;
  role?: string;
  metadata?: unknown;
  content?: PiProjectedMessage["content"];
  parts?: ReadonlyArray<{ type: string; text?: string; toolName?: string }>;
}): boolean {
  if (isHiddenOfficeUserMessage(message)) return false;
  const parts = message.content ?? message.parts ?? [];
  const text = parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part.type === "text" && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
  if (message.role === "assistant" && isOfficeReviewSkip(text)) {
    return false;
  }
  if (message.role === "user") {
    const visible = parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .filter((value) => !isComputerFileNote(value))
      .join("");
    return (
      visible.length > 0 ||
      parts.some((part) => part.type === "image" || part.type === "file")
    );
  }
  return (
    text.length > 0 ||
    parts.some(
      (part) =>
        part.type === "tool-call" ||
        part.type === "dynamic-tool" ||
        part.type.startsWith("tool-"),
    )
  );
}

export function coalesceAssistantMessages(
  messages: PiProjectedMessage[],
): PiProjectedMessage[] {
  return coalesceProjectedAssistants(messages.map(collapseTextParts));
}

export function splitQueuedFollowUps(
  messages: PiProjectedMessage[],
  busy: boolean,
): { thread: PiProjectedMessage[]; queued: PiProjectedMessage[] } {
  return splitQueuedProjectedFollowUps(messages, busy);
}

export { isVisibleProjectedMessage, presentPreviewFromParts };
