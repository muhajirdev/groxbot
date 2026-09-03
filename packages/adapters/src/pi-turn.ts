import { runAgentLoopContinue } from "@earendil-works/pi-agent-core";
import type {
  AgentEvent,
  AgentMessage,
  StreamFn,
} from "@earendil-works/pi-agent-core";
import type {
  Api,
  AssistantMessage,
  Context,
  Message,
  Model,
  StopReason,
  Usage,
} from "@earendil-works/pi-ai";
import {
  createAssistantMessageEventStream,
  contentText,
} from "@earendil-works/pi-ai";
import type { OwnedPiLine, OwnedPiTurn } from "@groxbot/adapter-kit";
import type { ChatMessage, GatewayConfig } from "./gateway.js";
import {
  completionUsage,
  deltaText,
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

function toPiMessages(
  lines: OwnedPiLine[],
  model: Model<Api>,
): Message[] {
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

export async function runPiTurn(input: {
  systemPrompt: string;
  messages: OwnedPiLine[];
  model: Model<Api>;
  streamFn: StreamFn;
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
      messages: toPiMessages(input.messages, input.model),
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

export async function runOwnedPiTurn(input: OwnedPiTurn & {
  model: Model<Api>;
  streamFn: StreamFn;
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => void | Promise<void>;
}): Promise<PiTurnResult> {
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

export function piContextToChatMessages(context: Context): ChatMessage[] {
  const messages: ChatMessage[] = [];
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
      const content = contentText(item.content).trim();
      if (content) messages.push({ role: "assistant", content });
    }
  }
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Hello" });
  }
  return messages;
}

function emitAssistantStream(
  stream: ReturnType<typeof createAssistantMessageEventStream>,
  model: Model<Api>,
  text: string,
  stopReason: Extract<StopReason, "stop" | "error" | "aborted">,
  options?: { usage?: Usage | null; errorMessage?: string },
): void {
  const message = assistantPiMessage(model, text, stopReason, options);
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
  if (text) {
    const started: AssistantMessage = {
      ...pending,
      content: [{ type: "text", text: "" }],
    };
    stream.push({ type: "text_start", contentIndex: 0, partial: started });
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
  }
  stream.push({ type: "done", reason: "stop", message });
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
        const response = await config.fetch(gatewayChatUrl(config), {
          method: "POST",
          headers: gatewayHeaders(config, metadata),
          body: JSON.stringify({
            model: gatewayRequestModel(model.id.trim() || config.model),
            stream: true,
            stream_options: { include_usage: true },
            messages: piContextToChatMessages(context),
          }),
          signal: options?.signal,
        });
        const raw = await readGatewayBody(response);
        if (!response.ok) {
          const text =
            raw.text ||
            (raw.stream ? await new Response(raw.stream).text() : "");
          emitAssistantStream(
            stream,
            model,
            "",
            "error",
            { errorMessage: gatewayErrorMessage(response.status, text) },
          );
          return;
        }
        let reply = "";
        let usage: Usage | null = null;
        if (raw.stream) {
          for await (const data of readSseData(raw.stream, options?.signal)) {
            if (options?.signal?.aborted) break;
            let payload: unknown;
            try {
              payload = JSON.parse(data) as unknown;
            } catch {
              continue;
            }
            const counted = completionUsage(payload);
            if (counted) usage = usageFromGateway(counted);
            const chunk = deltaText(payload);
            if (!chunk) continue;
            reply += chunk;
          }
        } else {
          try {
            const payload = JSON.parse(raw.text) as unknown;
            const counted = completionUsage(payload);
            if (counted) usage = usageFromGateway(counted);
            reply = deltaText(payload).trim() || raw.text.trim();
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
