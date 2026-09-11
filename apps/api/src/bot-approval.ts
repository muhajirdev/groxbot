/** Parks a paused Code Mode run until the office human approves. Like Ask. */

import {
  OFFICE_APPROVAL_REJECTED,
} from "@groxbot/core";

type Waiter = {
  resolve: (result: unknown) => void;
};

export class OfficeApprovalBoard {
  private waiters = new Map<string, Waiter>();
  private done = new Map<string, unknown>();

  wait(executionId: string, signal?: AbortSignal): Promise<unknown> {
    const id = executionId.trim();
    if (!id) return Promise.resolve(OFFICE_APPROVAL_REJECTED);
    const ready = this.done.get(id);
    if (ready !== undefined) {
      this.done.delete(id);
      return Promise.resolve(ready);
    }
    return new Promise((resolve) => {
      const finish = (result: unknown) => {
        const waiter = this.waiters.get(id);
        if (!waiter) return;
        this.waiters.delete(id);
        signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };
      const onAbort = () =>
        finish({
          status: "paused",
          executionId: id,
        });
      if (signal?.aborted) {
        resolve({ status: "paused", executionId: id });
        return;
      }
      this.waiters.set(id, { resolve: finish });
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  /** True when a live `code` execute is parked on this id. */
  resume(executionId: string, result: unknown): boolean {
    const id = executionId.trim();
    if (!id) return false;
    const waiter = this.waiters.get(id);
    if (waiter) {
      waiter.resolve(result);
      return true;
    }
    this.done.set(id, result);
    return false;
  }

  reject(executionId: string): boolean {
    return this.resume(executionId, OFFICE_APPROVAL_REJECTED);
  }

  isWaiting(executionId: string): boolean {
    return this.waiters.has(executionId.trim());
  }
}
