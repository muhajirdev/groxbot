/** Cloudflare-only. `@cloudflare/computer` Workspace + Worker shell.
 * Skip extra `@cloudflare/computer/shell/*` groups so unused just-bash
 * commands stay out of the bundle. Core is always on.
 */
import { Workspace } from "@cloudflare/computer";
import { WorkerShellBackend } from "@cloudflare/computer/backends/worker-shell";
import { COMPUTER_SHELL_BACKEND } from "@groxbot/core";

type WorkerShellLoader = ConstructorParameters<
  typeof WorkerShellBackend
>[0]["loader"];

export function createBotComputer(opts: {
  storage: DurableObjectStorage;
  loader: unknown;
  ctx: DurableObjectState;
  binding?: string;
}): Workspace {
  return new Workspace({
    storage: opts.storage,
    backends: [
      new WorkerShellBackend({
        id: COMPUTER_SHELL_BACKEND,
        loader: opts.loader as WorkerShellLoader,
        workspace: {
          binding: opts.binding ?? "ROOM_ACTOR",
          id: opts.ctx.id.toString(),
        },
        ctx: opts.ctx,
      }),
    ],
  });
}
