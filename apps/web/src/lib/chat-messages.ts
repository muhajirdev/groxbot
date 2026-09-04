import {
  isOfficeReviewSkip,
  isOfficeReviewUserMessage,
  presentPreviewFromParts,
} from "@groxbot/contracts";
import type { UIMessage } from "ai";
import { isComputerFileNote } from "./computer-attachment";

type TextPart = { type: "text"; text: string };

function isTextPart(part: UIMessage["parts"][number]): part is TextPart {
  return part.type === "text" && "text" in part;
}

/** Prefer the longest text part when a stream replay left a prefix duplicate. */
export function collapseTextParts(message: UIMessage): UIMessage {
  const parts = message.parts;
  const nextParts = parts.filter((part, index) => {
    if (!isTextPart(part) || !part.text) return true;
    return !parts.some((candidate, candidateIndex) => {
      if (candidateIndex === index || !isTextPart(candidate) || !candidate.text)
        return false;
      return (
        candidate.text.startsWith(part.text) &&
        (candidate.text.length > part.text.length || candidateIndex > index)
      );
    });
  });
  return nextParts.length === parts.length
    ? message
    : { ...message, parts: nextParts };
}

export function textFromMessage(message: UIMessage): string {
  return collapseTextParts(message)
    .parts.filter(isTextPart)
    .map((part) => part.text)
    .join("");
}

function visibleTextFromMessage(message: UIMessage): string {
  return collapseTextParts(message)
    .parts.filter(isTextPart)
    .map((part) => part.text)
    .filter((text) => !isComputerFileNote(text))
    .join("");
}

function hasFilePart(message: UIMessage): boolean {
  return message.parts.some(
    (part) => part.type === "file" || part.type === "image",
  );
}

/** Latest visible line for the sidebar — not used to reorder the list. */
export function lastOfficePreview(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (!row) continue;
    if (!isVisibleChatMessage(row)) continue;
    const text = visibleTextFromMessage(row).replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 140);
    const presented = presentPreviewFromParts(row.parts);
    if (presented) return presented;
  }
  return "";
}

export function usedTools(message: UIMessage): boolean {
  return message.parts.some(
    (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool",
  );
}

export function isVisibleChatMessage(message: {
  role?: string;
  metadata?: unknown;
  parts?: UIMessage["parts"];
}): boolean {
  if (isOfficeReviewUserMessage(message)) return false;
  if (!message.parts) return true;
  const asMessage = message as UIMessage;
  if (
    message.role === "assistant" &&
    isOfficeReviewSkip(textFromMessage(asMessage))
  ) {
    return false;
  }
  if (message.role === "user") {
    return (
      visibleTextFromMessage(asMessage).length > 0 || hasFilePart(asMessage)
    );
  }
  return textFromMessage(asMessage).length > 0 || usedTools(asMessage);
}

/**
 * Cloudflare sometimes keeps a local streaming assistant and the server
 * snapshot as two ids. Drop the shorter when one text contains the other.
 */
export function coalesceAssistantMessages(messages: UIMessage[]): UIMessage[] {
  const out: UIMessage[] = [];
  for (const raw of messages) {
    const message = collapseTextParts(raw);
    const prev = out.at(-1);
    if (prev?.role === "assistant" && message.role === "assistant") {
      const prevText = textFromMessage(prev);
      const nextText = textFromMessage(message);
      if (prevText && nextText && nextText.includes(prevText)) {
        out[out.length - 1] = message;
        continue;
      }
      if (prevText && nextText && prevText.includes(nextText)) {
        continue;
      }
    }
    out.push(message);
  }
  return out;
}

/**
 * While a turn is in flight, extra user submits sit in the office queue.
 * The live assistant may land before waiting follow-ups — pull them
 * out so the UI can show prompt → live reply → waiting follow-ups.
 */
export function splitQueuedFollowUps(
  messages: UIMessage[],
  busy: boolean,
): { thread: UIMessage[]; queued: UIMessage[] } {
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
  const usersBefore: UIMessage[] = [];
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
