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

  it("derives person vs group from homeRoomId, not rooms.kind", () => {
    const home = readSrc("bot-actor.ts");
    const room = readSrc("room-actor.ts");
    expect(home).toMatch(/isPersonRoom/);
    expect(room).not.toMatch(/parseRoomKind/);
    expect(room).not.toMatch(/storage\.put\("kind"/);
    expect(room).toMatch(/enqueueOnActor\(this\.env\.ROOM_ACTOR, homeRoomId/);
  });

  it("constructs Computer with WorkerShellBackend, not Think bash", () => {
    const actor = readSrc("bot-actor.ts");
    const factory = readSrc("bot-computer-workspace.ts");
    expect(factory).toMatch(/WorkerShellBackend/);
    expect(factory).toMatch(/COMPUTER_SHELL_BACKEND/);
    expect(actor).toMatch(/export class RoomHome extends Agent/);
    expect(actor).not.toMatch(/export class BotActor/);
    expect(actor).toMatch(/binding: "ROOM_ACTOR"/);
    expect(actor).not.toMatch(/extends Think/);
    expect(actor).toMatch(/createBotComputer\(/);
    expect(actor).toMatch(/createAITools\(/);
    expect(actor).toMatch(/computerWorkerShell\(\)/);
    expect(actor).toMatch(/__getWorkspaceStub/);
    expect(actor).not.toMatch(/@cloudflare\/shell/);
    expect(actor).not.toMatch(/from "@cloudflare\/think"/);
    expect(actor).toMatch(/createOfficeExecuteTool\(/);
    expect(actor).not.toMatch(/workspaceBash/);
  });

  it("builds execute from Code Mode, not Think or @cloudflare/shell", () => {
    const execute = readSrc("bot-execute.ts");
    const markdown = readSrc("bot-markdown.ts");
    expect(execute).toMatch(/createCodemodeRuntime/);
    expect(execute).toMatch(/toolSetConnector/);
    expect(execute).not.toMatch(/stateConnector/);
    expect(execute).not.toMatch(/createWorkspaceStateBackend/);
    expect(execute).not.toMatch(/@cloudflare\/shell/);
    expect(execute).not.toMatch(/@cloudflare\/think/);
    expect(markdown).toMatch(/runPublicFetch/);
    expect(markdown).not.toMatch(/@cloudflare\/think/);
  });

  it("exports WorkspaceServiceProxy for the shell HOST", () => {
    expect(readSrc("worker.ts")).toMatch(
      /export \{ WorkspaceServiceProxy \} from "@cloudflare\/computer"/,
    );
  });

  it("does not depend on @cloudflare/shell", () => {
    const pkg = JSON.parse(
      readFileSync(join(src, "../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).not.toHaveProperty("@cloudflare/shell");
  });
});
