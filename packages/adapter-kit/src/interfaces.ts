import type {
  AdapterContext,
  AgentRunRequest,
  AgentRuntimeEvent,
  CommandRequest,
  ComputerRef,
  PortableFile,
  ProcessEvent,
} from "./types.js";

export interface RealtimeFanout {
  publish(threadId: string, payload: string): Promise<void>;
  subscribe(
    threadId: string,
    onMessage: (payload: string) => void,
  ): Promise<() => Promise<void>>;
}

export interface HomeStore {
  readFile(
    botId: string,
    path: string,
    context: AdapterContext,
  ): Promise<string>;
  writeFile(
    botId: string,
    path: string,
    content: string,
    context: AdapterContext,
  ): Promise<void>;
  list(
    botId: string,
    path: string,
    context: AdapterContext,
  ): Promise<Array<{ path: string; kind: "file" | "dir"; size: number }>>;
  exportHome(
    botId: string,
    context: AdapterContext,
  ): AsyncIterable<PortableFile>;
}

export interface SandboxProvider {
  provision(
    request: { botId: string; homePath: string; providerRef?: string },
    context: AdapterContext,
  ): Promise<ComputerRef>;
  execute(
    computer: ComputerRef,
    request: CommandRequest,
    context: AdapterContext,
  ): AsyncIterable<ProcessEvent>;
  stop(computer: ComputerRef, context: AdapterContext): Promise<void>;
  destroy(computer: ComputerRef, context: AdapterContext): Promise<void>;
}

export interface AgentRuntime {
  run(
    request: AgentRunRequest,
    context: AdapterContext,
  ): AsyncIterable<AgentRuntimeEvent>;
  abort(runId: string): Promise<void>;
}

export class GuestOfflineError extends Error {
  constructor(botId: string) {
    super(`Guest runtime for ${botId} is not connected`);
    this.name = "GuestOfflineError";
  }
}
