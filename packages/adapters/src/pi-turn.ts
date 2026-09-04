import type {
  AgentEvent,
  AgentMessage,
  AgentTool,
  StreamFn,
} from "@earendil-works/pi-agent-core";
import { runAgentLoopContinue } from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Context,
  Message,
  Model,
  StopReason,
  ToolCall,
  Usage,
} from "@earendil-works/pi-ai";
import {
  contentText,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import type { OwnedPiLine, OwnedPiTurn } from "@groxbot/adapter-kit";
import type { ChatMessage, GatewayConfig } from "./gateway.js";
import {
  completionUsage,
  deltaText,
  deltaToolCalls,
  finishReason,
  gatewayChatUrl,
  gatewayErrorMessage,
  gatewayHeaders,
  gatewayRequestModel,
  readSseData,
} from "./gateway.js";

export type { StreamFn };

export function emptyPiUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function piCompletionsModel(id: string): Model<"openai-completions"> {
  const trimmed = id.trim() || "openai-completions";
  return {
    id: trimmed,
    name: trimmed,
    api: "openai-completions",
    provider: "openai",
    baseUrl: "",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
  };
}

export function usageFromGateway(usage: {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}): Usage {
  return {
    input: usage.promptTokens,
    output: usage.completionTokens,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: usage.totalTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

export function assistantPiMessage(
  model: Model<Api>,
  text: string,
  stopReason: StopReason,
  options?: { usage?: Usage | null; errorMessage?: string },
): AssistantMessage {
  return {
    role: "assistant",
    content: text ? [{ type: "text", text }] : [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: options?.usage ?? emptyPiUsage(),
    stopReason,
    errorMessage: options?.errorMessage,
    timestamp: Date.now(),
  };
}

function toPiMessages(lines: OwnedPiLine[], model: Model<Api>): Message[] {
  const now = Date.now();
  return lines.map((line, index) => {
    if (line.role === "user") {
      return {
        role: "user" as const,
        content: line.content,
        timestamp: now + index,
      };
    }
    return assistantPiMessage(model, line.content, "stop");
  });
}

function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message): message is Message =>
      message.role === "user" ||
      message.role === "assistant" ||
      message.role === "toolResult",
  );
}

export interface PiTurnResult {
  text: string;
  usage: Usage | null;
  stopReason: StopReason;
  errorMessage?: string;
}

function isPiMessage(value: OwnedPiLine | Message): value is Message {
  return "timestamp" in value;
}

function toLoopMessages(
  messages: Array<OwnedPiLine | Message>,
  model: Model<Api>,
): Message[] {
  if (messages.length > 0 && messages.every((row) => isPiMessage(row))) {
    return messages as Message[];
  }
  return toPiMessages(messages as OwnedPiLine[], model);
}

export async function runPiTurn(input: {
  systemPrompt: string;
  messages: Array<OwnedPiLine | Message>;
  model: Model<Api>;
  streamFn: StreamFn;
  tools?: AgentTool[];
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}): Promise<PiTurnResult> {
  let text = "";
  let usage: Usage | null = null;
  let stopReason: StopReason = "stop";
  let errorMessage: string | undefined;
  await runAgentLoopContinue(
    {
      systemPrompt: input.systemPrompt,
      messages: toLoopMessages(input.messages, input.model),
      tools: input.tools,
    },
    {
      model: input.model,
      convertToLlm,
      toolExecution: "sequential",
    },
    async (event) => {
      await input.onEvent?.(event);
      if (event.type !== "turn_end") return;
      if (event.message.role !== "assistant") return;
      const message = event.message;
      text = contentText(message.content);
      usage = message.usage;
      stopReason = message.stopReason;
      errorMessage = message.errorMessage;
    },
    input.signal,
    input.streamFn,
  );
  return { text, usage, stopReason, errorMessage };
}

export async function runOwnedPiTurn(
  input: OwnedPiTurn & {
    model: Model<Api>;
    streamFn: StreamFn;
    signal?: AbortSignal;
    onEvent?: (event: AgentEvent) => void | Promise<void>;
  },
): Promise<PiTurnResult> {
  return runPiTurn(input);
}

/** Offline StreamFn. Failures are encoded on the assistant message, never thrown. */
export function scriptedPiStreamFn(text: string): StreamFn {
  return (model, _context, options) => {
    const stream = createAssistantMessageEventStream();
    const finish = (message: AssistantMessage, kind: "done" | "error") => {
      if (kind === "done") {
        stream.push({
          type: "done",
          reason: message.stopReason === "length" ? "length" : "stop",
          message,
        });
      } else {
        stream.push({
          type: "error",
          reason: message.stopReason === "aborted" ? "aborted" : "error",
          error: message,
        });
      }
      stream.end(message);
    };
    queueMicrotask(() => {
      if (options?.signal?.aborted) {
        finish(
          assistantPiMessage(model, "", "aborted", {
            errorMessage: "Request was aborted",
          }),
          "error",
        );
        return;
      }
      const message = assistantPiMessage(model, text, "stop");
      const pending: AssistantMessage = {
        ...message,
        content: [],
        stopReason: "pending",
      };
      stream.push({ type: "start", partial: pending });
      const started: AssistantMessage = {
        ...pending,
        content: [{ type: "text", text: "" }],
      };
      stream.push({
        type: "text_start",
        contentIndex: 0,
        partial: started,
      });
      const filled: AssistantMessage = {
        ...pending,
        content: [{ type: "text", text }],
      };
      stream.push({
        type: "text_delta",
        contentIndex: 0,
        delta: text,
        partial: filled,
      });
      stream.push({
        type: "text_end",
        contentIndex: 0,
        content: text,
        partial: filled,
      });
      finish(message, "done");
    });
    return stream;
  };
}

/** Offline StreamFn that plays a sequence of text and/or tool-call turns. */
export function scriptedPiSequenceStreamFn(
  steps: Array<{
    text?: string;
    tool?: { id: string; name: string; arguments?: Record<string, unknown> };
  }>,
): StreamFn {
  let index = 0;
  return (model, _context, options) => {
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      if (options?.signal?.aborted) {
        emitAssistantStream(stream, model, "", "aborted", {
          errorMessage: "Request was aborted",
        });
        return;
      }
      const step = steps[index] ?? { text: "" };
      index += 1;
      if (step.tool) {
        emitAssistantStream(stream, model, step.text ?? "", "toolUse", {
          toolCalls: [
            {
              type: "toolCall",
              id: step.tool.id,
              name: step.tool.name,
              arguments: step.tool.arguments ?? {},
            },
          ],
        });
        return;
      }
      emitAssistantStream(stream, model, step.text ?? "", "stop");
    });
    return stream;
  };
}

export type GatewayChatMessage =
  | ChatMessage
  | {
      role: "assistant";
      content: string | null;
      tool_calls: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

export function piContextToChatMessages(
  context: Context,
): GatewayChatMessage[] {
  const messages: GatewayChatMessage[] = [];
  const system = context.systemPrompt?.trim();
  if (system) messages.push({ role: "system", content: system });
  for (const item of context.messages) {
    if (item.role === "user") {
      const content =
        typeof item.content === "string"
          ? item.content.trim()
          : contentText(item.content).trim();
      if (content) messages.push({ role: "user", content });
      continue;
    }
    if (item.role === "assistant") {
      const text = contentText(item.content).trim();
      const calls = item.content.filter(
        (part): part is ToolCall => part.type === "toolCall",
      );
      if (calls.length > 0) {
        messages.push({
          role: "assistant",
          content: text || null,
          tool_calls: calls.map((call) => ({
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments ?? {}),
            },
          })),
        });
        continue;
      }
      if (text) messages.push({ role: "assistant", content: text });
      continue;
    }
    if (item.role === "toolResult") {
      messages.push({
        role: "tool",
        tool_call_id: item.toolCallId,
        content: contentText(item.content) || stringifyUnknown(item.details),
      });
    }
  }
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }
  return messages;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function openaiTools(context: Context): unknown[] | undefined {
  if (!context.tools?.length) return undefined;
  return context.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: jsonSchemaFromParameters(tool.parameters),
    },
  }));
}

function jsonSchemaFromParameters(
  parameters: unknown,
): Record<string, unknown> {
  try {
    const raw = JSON.parse(JSON.stringify(parameters)) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
  } catch {
    // TypeBox symbols or cycles.
  }
  return { type: "object", additionalProperties: true };
}

type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

function mergeToolCallDelta(
  pending: PendingToolCall[],
  delta: { index: number; id?: string; name?: string; arguments?: string },
): void {
  const current = pending[delta.index] ?? {
    id: delta.id || `call_${delta.index}`,
    name: delta.name || "",
    arguments: "",
  };
  pending[delta.index] = {
    id: delta.id || current.id,
    name: delta.name || current.name,
    arguments: `${current.arguments}${delta.arguments ?? ""}`,
  };
}

function parsedToolCalls(pending: PendingToolCall[]): ToolCall[] {
  return pending
    .filter((row) => row?.name)
    .map((row) => ({
      type: "toolCall" as const,
      id: row.id,
      name: row.name,
      arguments: parseToolArguments(row.arguments),
    }));
}

function parseToolArguments(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { raw: trimmed };
  }
  return { raw: trimmed };
}

function emitAssistantStream(
  stream: ReturnType<typeof createAssistantMessageEventStream>,
  model: Model<Api>,
  text: string,
  stopReason: Extract<StopReason, "stop" | "error" | "aborted" | "toolUse">,
  options?: {
    usage?: Usage | null;
    errorMessage?: string;
    toolCalls?: ToolCall[];
  },
): void {
  const toolCalls = options?.toolCalls ?? [];
  const content: AssistantMessage["content"] = [];
  if (text) content.push({ type: "text", text });
  content.push(...toolCalls);
  const message: AssistantMessage = {
    ...assistantPiMessage(model, text, stopReason, options),
    content,
    stopReason,
  };
  if (stopReason === "error" || stopReason === "aborted") {
    stream.push({
      type: "error",
      reason: stopReason,
      error: message,
    });
    stream.end(message);
    return;
  }
  const pending: AssistantMessage = {
    ...message,
    content: [],
    stopReason: "pending",
  };
  stream.push({ type: "start", partial: pending });
  let contentIndex = 0;
  if (text) {
    const started: AssistantMessage = {
      ...pending,
      content: [{ type: "text", text: "" }],
    };
    stream.push({ type: "text_start", contentIndex, partial: started });
    const filled: AssistantMessage = {
      ...pending,
      content: [{ type: "text", text }],
    };
    stream.push({
      type: "text_delta",
      contentIndex,
      delta: text,
      partial: filled,
    });
    stream.push({
      type: "text_end",
      contentIndex,
      content: text,
      partial: filled,
    });
    contentIndex += 1;
  }
  const built: AssistantMessage["content"] = text
    ? [{ type: "text", text }]
    : [];
  for (const call of toolCalls) {
    built.push(call);
    const partial: AssistantMessage = {
      ...pending,
      content: built.slice(),
    };
    stream.push({ type: "toolcall_start", contentIndex, partial });
    stream.push({
      type: "toolcall_end",
      contentIndex,
      toolCall: call,
      partial,
    });
    contentIndex += 1;
  }
  stream.push({
    type: "done",
    reason: stopReason === "toolUse" ? "toolUse" : "stop",
    message,
  });
  stream.end(message);
}

/**
 * Worker-safe StreamFn: existing gateway SSE, not `pi-ai/api/openai-completions`.
 * Must not throw — failures are `stopReason` error/aborted on the assistant message.
 */
export function createGatewayStreamFn(
  config: GatewayConfig,
  metadata?: Record<string, string | undefined>,
): StreamFn {
  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();
    void (async () => {
      try {
        const tools = openaiTools(context);
        const response = await config.fetch(gatewayChatUrl(config), {
          method: "POST",
          headers: gatewayHeaders(config, metadata),
          body: JSON.stringify({
            model: gatewayRequestModel(model.id.trim() || config.model),
            stream: true,
            stream_options: { include_usage: true },
            messages: piContextToChatMessages(context),
            ...(tools ? { tools } : {}),
          }),
          signal: options?.signal,
        });
        const raw = await readGatewayBody(response);
        if (!response.ok) {
          const text =
            raw.text ||
            (raw.stream ? await new Response(raw.stream).text() : "");
          emitAssistantStream(stream, model, "", "error", {
            errorMessage: gatewayErrorMessage(response.status, text),
          });
          return;
        }
        let reply = "";
        let usage: Usage | null = null;
        const pendingCalls: PendingToolCall[] = [];
        let reason: string | null = null;
        const absorb = (payload: unknown) => {
          const counted = completionUsage(payload);
          if (counted) usage = usageFromGateway(counted);
          const ended = finishReason(payload);
          if (ended) reason = ended;
          const chunk = deltaText(payload);
          if (chunk) reply += chunk;
          for (const call of deltaToolCalls(payload)) {
            mergeToolCallDelta(pendingCalls, call);
          }
        };
        if (raw.stream) {
          for await (const data of readSseData(raw.stream, options?.signal)) {
            if (options?.signal?.aborted) break;
            try {
              absorb(JSON.parse(data) as unknown);
            } catch {}
          }
        } else {
          try {
            absorb(JSON.parse(raw.text) as unknown);
            if (!reply && pendingCalls.length === 0) {
              reply = deltaText(JSON.parse(raw.text)).trim() || raw.text.trim();
            }
          } catch {
            reply = raw.text.trim();
          }
        }
        if (options?.signal?.aborted) {
          emitAssistantStream(stream, model, reply, "aborted", {
            usage,
            errorMessage: "Request was aborted",
          });
          return;
        }
        const toolCalls = parsedToolCalls(pendingCalls);
        if (toolCalls.length > 0 || reason === "tool_calls") {
          emitAssistantStream(stream, model, reply, "toolUse", {
            usage,
            toolCalls,
          });
          return;
        }
        if (!reply.trim()) {
          emitAssistantStream(stream, model, "", "error", {
            usage,
            errorMessage: "AI gateway returned an empty reply",
          });
          return;
        }
        emitAssistantStream(stream, model, reply, "stop", { usage });
      } catch (error) {
        if (isAbortError(error) || options?.signal?.aborted) {
          emitAssistantStream(stream, model, "", "aborted", {
            errorMessage: "Request was aborted",
          });
          return;
        }
        emitAssistantStream(stream, model, "", "error", {
          errorMessage:
            error instanceof Error ? error.message : "AI gateway failed",
        });
      }
    })();
    return stream;
  };
}

async function readGatewayBody(response: Response): Promise<{
  text: string;
  stream?: ReadableStream<Uint8Array>;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("event-stream") && response.body) {
    return { text: "", stream: response.body };
  }
  const text = await response.text();
  if (/^\s*data:/m.test(text) || text.includes("data: [DONE]")) {
    const bytes = new TextEncoder().encode(text);
    return {
      text,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    };
  }
  return { text };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}
