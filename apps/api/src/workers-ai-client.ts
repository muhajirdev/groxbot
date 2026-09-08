/** Cloudflare Workers AI LLMClient for Stagehand 2.5.x. */
import type {
  CreateChatCompletionOptions,
  LogLine,
} from "@browserbasehq/stagehand";

type AiBinding = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
};

type WorkersAIOptions = {
  gateway?: { id: string };
  logger?: (line: LogLine) => void;
};

const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Minimal Stagehand LLMClient over Workers AI (act path; no zod extract). */
export class WorkersAIClient {
  public type = "workers-ai" as const;
  public modelName = MODEL_ID;
  private binding: AiBinding;
  private options?: WorkersAIOptions;

  constructor(binding: AiBinding, options?: WorkersAIOptions) {
    this.binding = binding;
    this.options = options;
  }

  async createChatCompletion<T>({
    options,
  }: CreateChatCompletionOptions): Promise<T> {
    this.options?.logger?.({ category: "workersai", message: "thinking..." });
    const result = (await this.binding.run(
      this.modelName,
      {
        messages: options.messages,
        tools: options.tools,
        temperature: 0,
      },
      this.options?.gateway ? { gateway: this.options.gateway } : undefined,
    )) as { response?: unknown };
    this.options?.logger?.({
      category: "workersai",
      message: "completed thinking!",
    });
    return { data: result?.response } as T;
  }
}
