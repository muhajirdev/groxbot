import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPUTER_SHELL_BACKEND, computerWorkerShell } from "@groxbot/core";
import { describe, expect, it } from "vitest";

const src = join(import.meta.dirname);

function readSrc(name: string): string {
  return readFileSync(join(src, name), "utf8");
}

describe("Computer Worker shell wiring", () => {
  it("names the Worker shell backend worker-shell", () => {
    expect(COMPUTER_SHELL_BACKEND).toBe("worker-shell");
    expect(computerWorkerShell().defaultBackend).toBe("worker-shell");
  });

  it("constructs Computer with WorkerShellBackend, not Think bash", () => {
    const actor = readSrc("bot-actor.ts");
    const factory = readSrc("bot-computer-workspace.ts");
    expect(factory).toMatch(/WorkerShellBackend/);
    expect(factory).toMatch(/COMPUTER_SHELL_BACKEND/);
    expect(actor).toMatch(/override workspaceBash = false/);
    expect(actor).toMatch(/createBotComputer\(/);
    expect(actor).toMatch(/createAITools\(/);
    expect(actor).toMatch(/computerWorkerShell\(\)/);
    expect(actor).toMatch(/__getWorkspaceStub/);
    expect(actor).not.toMatch(/from "@cloudflare\/shell"/);
    expect(actor).not.toMatch(/workspaceBash = true/);
  });

  it("exports WorkspaceServiceProxy for the shell HOST", () => {
    expect(readSrc("worker.ts")).toMatch(
      /export \{ WorkspaceServiceProxy \} from "@cloudflare\/computer"/,
    );
  });

  it("enables experimental so the Worker loader can run just-bash", () => {
    const wrangler = readFileSync(join(src, "../wrangler.jsonc"), "utf8");
    expect(wrangler).toMatch(/"experimental"/);
    expect(wrangler).toMatch(/"binding": "LOADER"/);
  });
});
