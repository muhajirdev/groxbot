import type { AgentEvent, AgentTool } from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Message,
  Model,
  ToolCall,
  ToolResultMessage,
} from "@earendil-works/pi-ai";
import type { OfficeChatMessage, OfficeChatPart } from "@groxbot/core";
import {
  officeChatText,
  stringifyToolOutput,
  toolNameFromPart,
} from "@groxbot/core";
import { assistantPiMessage } from "./pi-turn.js";

export type OfficeDraft = {
  id: string;
  parts: OfficeChatPart[];
};

export function emptyOfficeDraft(id: string): OfficeDraft {
  return { id, parts: [] };
}

export function officeDraftMessage(draft: OfficeDraft): OfficeChatMessage {
  return { id: draft.id, role: "assistant", parts: draft.parts };
}

export function officeLogToPiMessages(
  messages: readonly OfficeChatMessage[],
  model: Model<Api>,
): Message[] {
  const out: Message[] = [];
  const now = Date.now();
  for (const [index, row] of messages.entries()) {
    const timestamp = row.createdAt ?? now + index;
    if (row.role === "user") {
      const content = officeChatText(row);
      if (!content) continue;
      out.push({ role: "user", content, timestamp });
      continue;
    }
    if (row.role !== "assistant") continue;
    const content: AssistantMessage["content"] = [];
    const results: ToolResultMessage[] = [];
    for (const part of row.parts) {
      if (part.type === "text" && typeof part.text === "string") {
        if (part.text) content.push({ type: "text", text: part.text });
        continue;
      }
      const name = toolNameFromPart(part);
      if (!name) continue;
      const id =
        typeof part.toolCallId === "string" && part.toolCallId
          ? part.toolCallId
          : `tool_${index}_${content.length}`;
      const args =
        part.input &&
        typeof part.input === "object" &&
        !Array.isArray(part.input)
          ? (part.input as Record<string, unknown>)
          : {};
      content.push({
        type: "toolCall",
        id,
        name,
        arguments: args,
      });
      const state = typeof part.state === "string" ? part.state : "";
      if (
        state === "output-available" ||
        state === "output-error" ||
        part.output !== undefined
      ) {
        results.push({
          role: "toolResult",
          toolCallId: id,
          toolName: name,
          content: [{ type: "text", text: stringifyToolOutput(part.output) }],
          details: part.output,
          isError: state === "output-error",
          timestamp,
        });
      }
    }
    if (content.length === 0 && results.length === 0) {
      const text = officeChatText(row);
      if (text) content.push({ type: "text", text });
    }
    if (content.length === 0) continue;
    const stopReason = results.length > 0 ? "toolUse" : "stop";
    const assistant = assistantPiMessage(
      model,
      content.some((part) => part.type === "text")
        ? content
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("")
        : "",
      stopReason,
    );
    out.push({ ...assistant, content, timestamp });
    out.push(...results);
  }
  return out;
}

export function applyOfficeAgentEvent(
  draft: OfficeDraft,
  event: AgentEvent,
): OfficeDraft {
  if (event.type === "message_update") {
    return applyAssistantEvent(draft, event.assistantMessageEvent);
  }
  if (event.type === "tool_execution_start") {
    return upsertToolPart(draft, {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      state: "input-available",
      input: event.args,
    });
  }
  if (event.type === "tool_execution_end") {
    return upsertToolPart(draft, {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      state: event.isError ? "output-error" : "output-available",
      output: event.result,
      errorText: event.isError ? stringifyToolOutput(event.result) : undefined,
    });
  }
  if (event.type === "message_end" || event.type === "turn_end") {
    if (event.message.role !== "assistant") return draft;
    return applyAssistantContent(draft, event.message.content);
  }
  return draft;
}

function applyAssistantEvent(
  draft: OfficeDraft,
  event: {
    type: string;
    contentIndex?: number;
    delta?: string;
    partial?: AssistantMessage;
    toolCall?: ToolCall;
    content?: string;
  },
): OfficeDraft {
  if (event.type === "text_delta" && typeof event.delta === "string") {
    return appendText(draft, event.delta);
  }
  if (event.type === "text_end" && typeof event.content === "string") {
    return setText(draft, event.content);
  }
  const call =
    event.toolCall ?? toolCallAt(event.partial?.content, event.contentIndex);
  if (!call) return draft;
  const streaming =
    event.type === "toolcall_end" ? "input-available" : "input-streaming";
  return upsertToolPart(draft, {
    toolCallId: call.id,
    toolName: call.name,
    state: streaming,
    input: call.arguments,
  });
}

function applyAssistantContent(
  draft: OfficeDraft,
  content: AssistantMessage["content"],
): OfficeDraft {
  let next = { ...draft, parts: draft.parts.slice() };
  for (const part of content) {
    if (part.type === "text") next = setText(next, part.text);
    if (part.type === "toolCall") {
      next = upsertToolPart(next, {
        toolCallId: part.id,
        toolName: part.name,
        state: "input-available",
        input: part.arguments,
      });
    }
  }
  return next;
}

function toolCallAt(
  content: AssistantMessage["content"] | undefined,
  index: number | undefined,
): ToolCall | null {
  if (!content || index == null) return null;
  const part = content[index];
  return part?.type === "toolCall" ? part : null;
}

function appendText(draft: OfficeDraft, delta: string): OfficeDraft {
  if (!delta) return draft;
  const parts = draft.parts.slice();
  const last = parts.at(-1);
  if (last?.type === "text" && typeof last.text === "string") {
    parts[parts.length - 1] = { ...last, text: last.text + delta };
    return { ...draft, parts };
  }
  parts.push({ type: "text", text: delta });
  return { ...draft, parts };
}

function setText(draft: OfficeDraft, text: string): OfficeDraft {
  const parts = draft.parts.filter((part) => part.type !== "text");
  if (text) parts.unshift({ type: "text", text });
  return { ...draft, parts };
}

function upsertToolPart(
  draft: OfficeDraft,
  input: {
    toolCallId: string;
    toolName: string;
    state: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  },
): OfficeDraft {
  const type = `tool-${input.toolName}`;
  const parts = draft.parts.slice();
  const index = parts.findIndex(
    (part) =>
      part.toolCallId === input.toolCallId ||
      (toolNameFromPart(part) === input.toolName &&
        part.toolCallId == null &&
        part.state === "input-streaming"),
  );
  const next: OfficeChatPart = {
    type,
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    state: input.state,
    ...(input.input !== undefined ? { input: input.input } : {}),
    ...(input.output !== undefined ? { output: input.output } : {}),
    ...(input.errorText ? { errorText: input.errorText } : {}),
  };
  if (index >= 0) {
    parts[index] = { ...parts[index], ...next };
  } else {
    parts.push(next);
  }
  return { ...draft, parts };
}

export function openObjectParameters(): AgentTool["parameters"] {
  return {
    type: "object",
    additionalProperties: true,
  } as AgentTool["parameters"];
}
