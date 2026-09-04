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
    expect(room).toMatch(/runGuestTurn/);
    expect(room).toMatch(/personDoorContext/);
    expect(room).toMatch(/buildOfficeSystemPrompt/);
    expect(room).not.toMatch(/enqueueOnActor\(this\.env\.ROOM_ACTOR, homeRoomId/);
    expect(home).toMatch(/\/door\/context/);
    expect(home).toMatch(/handleDoorTool/);
    expect(home).toMatch(/isMcpOAuthCallbackPath/);
    expect(home).toMatch(/handleMcpOAuth/);
    expect(home).toMatch(/handleCallbackRequest/);
    expect(home).toMatch(/mcp:\s*this\.workspaceMcp/);
    expect(home).toMatch(/hostMcpConnectionLike/);
    expect(home).toMatch(/remoteMcpConnection/);
    expect(home).toMatch(/\/mcp\/tools/);
    expect(home).toMatch(/\/mcp\/call/);
    expect(home).not.toMatch(/runRoomTurn/);
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
    expect(actor).toMatch(/parseTinyfishKeys/);
    expect(actor).toMatch(/TinyfishKeyPool/);
    expect(actor).toMatch(/createSkillTool\(/);
    expect(actor).toMatch(/applyOfficeSkillsToSystem/);
    expect(actor).toMatch(/loadOfficeSkillCatalog/);
    expect(actor).toMatch(/buildOfficeSystemPrompt/);
    expect(actor).toMatch(/officeIntroTurnTools/);
    expect(actor).toMatch(/lastOfficeUserIsIntro/);
    expect(actor).toMatch(/runOfficeReviewTurn/);
    expect(actor).toMatch(/officeReviewAnnounce/);
    expect(actor).toMatch(/appendOfficeAssistantText/);
    expect(actor).not.toMatch(/hasActivateSkill/);
    expect(actor).not.toMatch(/activate_skill/);
    expect(readSrc("bot-skill.ts")).toMatch(/SKILL_TOOL_NAME/);
    expect(actor).toMatch(/officeAgentTool/);
    expect(actor).not.toMatch(/from "ai"/);
    expect(actor).not.toMatch(/officeToolSet/);
    expect(actor).not.toMatch(/workspaceBash/);
    expect(actor).toMatch(/sqliteSessionStore|DurableSessionStorage/);
    expect(actor).toMatch(/HistoryConnector/);
    expect(actor).toMatch(/officeHistorySearch/);
    expect(actor).toMatch(/ensureComputerHome/);
    expect(actor).toMatch(/jsonClone/);
    expect(actor).not.toMatch(/writeOfficeLog\(/);
  });

  it("builds execute from Code Mode, not Think or @cloudflare/shell", () => {
    const execute = readSrc("bot-execute.ts");
    const markdown = readSrc("bot-markdown.ts");
    expect(execute).toMatch(/createCodemodeRuntime/);
    expect(execute).toMatch(/toolSetConnector/);
    expect(execute).toMatch(/from "ai"/);
    expect(markdown).not.toMatch(/from "ai"/);
    expect(readSrc("bot-present.ts")).not.toMatch(/from "ai"/);
    expect(readSrc("bot-skill.ts")).not.toMatch(/from "ai"/);
    expect(execute).not.toMatch(/stateConnector/);
    expect(execute).not.toMatch(/createWorkspaceStateBackend/);
    expect(execute).not.toMatch(/@cloudflare\/shell/);
    expect(execute).not.toMatch(/@cloudflare\/think/);
    expect(markdown).toMatch(/runPublicFetch/);
    expect(markdown).toMatch(/runTinyfishSearch/);
    expect(markdown).toMatch(/web_search/);
    expect(execute).toMatch(/bindOfficeExecuteTool/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/OFFICE_CODE_TOOL_NAME/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/executeCodeFromInput/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/~standard/);
    expect(markdown).not.toMatch(/@cloudflare\/think/);
  });

  it("exports WorkspaceServiceProxy for the shell HOST", () => {
    expect(readSrc("worker.ts")).toMatch(
      /export \{ WorkspaceServiceProxy \} from "@cloudflare\/computer"/,
    );
    expect(readSrc("bot-office-tools.ts")).toMatch(/resolveAiSdkToolResult/);
  });

  it("binds ROOM_ACTOR to the provisioned BotActor class", () => {
    const wrangler = readFileSync(join(src, "../wrangler.jsonc"), "utf8");
    expect(wrangler).toMatch(/"name": "ROOM_ACTOR"/);
    expect(wrangler).toMatch(/"class_name": "BotActor"/);
    expect(wrangler).not.toMatch(/"tag": "v3"/);
    expect(wrangler).not.toMatch(/"deleted_classes"/);
    expect(wrangler).not.toMatch(/"experimental"/);
    expect(readSrc("worker.ts")).toMatch(/RoomActor as BotActor/);
    expect(readSrc("worker.ts")).toMatch(/probeBotMcp/);
  });

  it("does not depend on @cloudflare/shell", () => {
    const pkg = JSON.parse(
      readFileSync(join(src, "../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).not.toHaveProperty("@cloudflare/shell");
  });
});
