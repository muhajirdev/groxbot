/** Socket identity from `useAgent`. A captured `ready` promise goes stale on reconnect. */
export type AgentReadyHandle = {
  identified: boolean;
  ready: Promise<void>;
};

export const AGENT_READY_TIMEOUT_MS = 20_000;

function abortError(): Error {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/**
 * Wait until the live agent socket has identified. `useAgent` replaces `ready`
 * on close/reconnect, so awaiting a closed-over promise hangs forever — the
 * new identity never resolves the old one.
 */
export async function waitForAgentReady(
  getAgent: () => AgentReadyHandle,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? AGENT_READY_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? 50;
  const signal = options.signal;
  const started = Date.now();
  throwIfAborted(signal);

  while (!getAgent().identified) {
    throwIfAborted(signal);
    if (Date.now() - started >= timeoutMs) {
      throw new Error("Could not reach this teammate. Try sending again.");
    }
    const ready = getAgent().ready;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        clearTimeout(timer);
        fn();
      };
      const onAbort = () => finish(() => reject(abortError()));
      const timer = setTimeout(() => finish(resolve), intervalMs);
      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
      void ready.then(
        () => finish(resolve),
        () => finish(resolve),
      );
    });
  }
}
