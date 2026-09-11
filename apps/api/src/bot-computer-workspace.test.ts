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
    expect(room).toMatch(/isThoughtSignatureError/);
    expect(room).toMatch(/stripThoughtReplay/);
    expect(room).toMatch(/personDoorContext/);
    expect(room).toMatch(/buildOfficeSystemPrompt/);
    expect(room).not.toMatch(
      /enqueueOnActor\(this\.env\.ROOM_ACTOR, homeRoomId/,
    );
    expect(home).toMatch(/\/door\/context/);
    expect(home).toMatch(/handleDoorTool/);
    expect(home).toMatch(/mcp:\s*this\.workspaceMcp/);
    expect(home).toMatch(/httpMcpConnectionLike/);
    expect(home).toMatch(/WorkspaceMcpConnector/);
    expect(home).toMatch(/PluginsConnector/);
    expect(home).not.toMatch(/createMcpOAuthProvider/);
    expect(home).not.toMatch(/handleMcpOAuth/);
    expect(home).not.toMatch(/addMcpServer/);
    expect(home).not.toMatch(/this\.mcp\./);
    expect(home).not.toMatch(/\/mcp\/tools/);
    expect(home).not.toMatch(/\/mcp\/call/);
    expect(home).not.toMatch(/runRoomTurn/);
    expect(home).toMatch(/createStampAppTool/);
    expect(home).not.toMatch(/mergeOfficeAppStamp/);
    expect(room).toMatch(/stampAppTools/);
    expect(room).not.toMatch(/mergeOfficeAppStamp/);
  });

  it("keeps workspace MCP as Code Mode connectors inside execute", () => {
    const home = readSrc("bot-actor.ts");
    const execute = readSrc("bot-execute.ts");
    const connector = readSrc("bot-mcp-connector.ts");
    expect(connector).toMatch(
      /class WorkspaceMcpConnector extends McpConnector/,
    );
    expect(connector).toMatch(/createConnection/);
    expect(readSrc("bot-plugins.ts")).toMatch(
      /class PluginsConnector extends CodemodeConnector/,
    );
    expect(readSrc("bot-plugins.ts")).toMatch(
      /Several accounts can run this tool/,
    );
    expect(readSrc("bot-plugins.ts")).toMatch(/plugins\.search\(\{ query \}\)/);
    expect(readSrc("bot-plugins.ts")).not.toMatch(/GMAIL_FETCH_EMAILS/);
    expect(readSrc("bot-plugins.ts")).toMatch(/capToolPayload/);
    expect(home).toMatch(/mcpExecuteConnectors/);
    expect(home).toMatch(/pluginExecuteConnectors/);
    expect(home).toMatch(/compactOfficeSession/);
    expect(home).toMatch(/reloadOfficeBrain/);
    expect(home).toMatch(/\/reload-brain/);
    expect(home).toMatch(/isContextOverflowError/);
    expect(home).toMatch(/isContextOverflowError\(result\.errorMessage\)/);
    expect(home).toMatch(/isThoughtSignatureError/);
    expect(home).toMatch(/isThoughtSignatureError\(result\.errorMessage\)/);
    expect(home).toMatch(/thought_signature_retry/);
    expect(home).toMatch(/stripThoughtReplay/);
    expect(home).toMatch(/force:\s*true/);
    expect(home).toMatch(/executeConnectors/);
    expect(home).toMatch(/createOfficeExecuteTool/);
    expect(home).toMatch(/withOfficeExecuteDescription/);
    expect(home).toMatch(/httpMcpConnectionLike/);
    expect(execute).toMatch(/createCodemodeRuntime/);
    expect(execute).toMatch(/connectors\.push\(\.\.\.opts\.connectors\)/);
    expect(home).not.toMatch(/name:\s*"mcp"/);
    expect(readSrc("bot-bots-connector.ts")).toMatch(
      /class BotsConnector extends CodemodeConnector/,
    );
    expect(readSrc("bot-bots-connector.ts")).toMatch(/requiresApproval: true/);
    expect(readSrc("bot-bots-connector.ts")).toMatch(/bots\.hire/);
    expect(readSrc("bot-cursor-connector.ts")).toMatch(
      /class CursorConnector extends CodemodeConnector/,
    );
    expect(readSrc("bot-cursor-connector.ts")).toMatch(
      /requiresApproval: true/,
    );
    expect(readSrc("bot-cursor-connector.ts")).toMatch(/cursor\.launch/);
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
    expect(actor).toMatch(/TOOL_TRUNCATE_MAX_BYTES/);
    expect(actor).toMatch(/\.tool-output/);
    expect(actor).toMatch(/__getWorkspaceStub/);
    expect(actor).not.toMatch(/@cloudflare\/shell/);
    expect(actor).not.toMatch(/from "@cloudflare\/think"/);
    expect(actor).toMatch(/parseTinyfishKeys/);
    expect(actor).toMatch(/TinyfishKeyPool/);
    expect(actor).toMatch(/createSkillTool\(/);
    expect(actor).toMatch(/createAskTool\(/);
    expect(actor).toMatch(/officeAsk\.enterLive/);
    expect(actor).toMatch(/OfficeApprovalBoard/);
    expect(actor).toMatch(/onPaused:/);
    expect(actor).toMatch(/officeApproval\.wait/);
    expect(actor).toMatch(/officeApproval\.resume/);
    expect(actor).toMatch(/officeApproval\.reject/);
    expect(readSrc("bot-ask.ts")).toMatch(/OFFICE_ASK_TOOL_NAME/);
    expect(actor).toMatch(/applyOfficeSkillsToSystem/);
    expect(actor).toMatch(/loadOfficeSkillCatalog/);
    expect(actor).toMatch(/buildOfficeSystemPrompt/);
    expect(actor).toMatch(/officeIntroTurnTools/);
    expect(actor).toMatch(/lastOfficeUserIsIntro/);
    expect(actor).toMatch(/ensureOfficeChatTable/);
    expect(actor).toMatch(/loadBot miss/);
    expect(actor).toMatch(/runOfficeReviewTurn/);
    expect(actor).toMatch(/officeReviewAnnounce/);
    expect(actor).toMatch(/appendOfficeAssistantText/);
    expect(actor).toMatch(/createStampAppTool/);
    expect(actor).toMatch(/recordAppChatCard/);
    expect(actor).toMatch(/DurableObjectAppStore/);
    expect(actor).not.toMatch(/parseAppIntent/);
    expect(actor).not.toMatch(/mergeOfficeAppStamp/);
    expect(actor).not.toMatch(/hasActivateSkill/);
    expect(actor).not.toMatch(/activate_skill/);
    expect(readSrc("bot-skill.ts")).toMatch(/SKILL_TOOL_NAME/);
    expect(actor).toMatch(/officeAgentTool/);
    expect(actor).not.toMatch(/from "ai"/);
    expect(actor).not.toMatch(/officeToolSet/);
    expect(actor).not.toMatch(/workspaceBash/);
    expect(actor).toMatch(/sqliteSessionStore|DurableSessionStorage/);
    expect(actor).toMatch(/HistoryConnector/);
    expect(actor).toMatch(/BotsConnector/);
    expect(actor).toMatch(/hireTeammate/);
    expect(actor).toMatch(/bots:\s*true/);
    expect(actor).toMatch(/CursorConnector/);
    expect(actor).toMatch(/launchCursorAgent/);
    expect(actor).toMatch(/pollCursorCloudAgent/);
    expect(actor).toMatch(/cursor:\s*true/);
    expect(readSrc("bot-cursor-connector.ts")).toMatch(
      /class CursorConnector extends CodemodeConnector/,
    );
    expect(readSrc("bot-cursor-connector.ts")).toMatch(
      /requiresApproval: true/,
    );
    expect(readSrc("bot-cursor-connector.ts")).toMatch(/cursor\.launch/);
    expect(actor).toMatch(/PluginsConnector/);
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
    expect(readSrc("bot-present.ts")).toMatch(/passthrough\(\)/);
    expect(readSrc("bot-present.ts")).not.toMatch(/\$type:\s*z/);
    expect(readSrc("bot-present.ts")).toMatch(/PRESENT_TOOL_PARAMETERS/);
    expect(readSrc("bot-skill.ts")).not.toMatch(/from "ai"/);
    expect(execute).not.toMatch(/stateConnector/);
    expect(execute).not.toMatch(/createWorkspaceStateBackend/);
    expect(execute).not.toMatch(/@cloudflare\/shell/);
    expect(execute).not.toMatch(/@cloudflare\/think/);
    expect(markdown).toMatch(/runPublicFetch/);
    expect(markdown).toMatch(/runTinyfishSearch/);
    expect(markdown).toMatch(/web_search/);
    expect(readSrc("bot-browser.ts")).toMatch(/render_pdf/);
    expect(readSrc("bot-browser.ts")).toMatch(/render_screenshot/);
    expect(readSrc("bot-browser.ts")).not.toMatch(/stagehand/i);
    expect(readSrc("bot-actor.ts")).toMatch(/createBrowserAgentTools/);
    expect(readSrc("bot-actor.ts")).toMatch(/emitOfficeDebug/);
    expect(readSrc("bot-actor.ts")).toMatch(/debug_log/);
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
    expect(readSrc("bot-office-tools.ts")).toMatch(/rewriteComputerToolArgs/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/computerReadConverts/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/computerImageFromRead/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/officeShellCommandRefusal/);
    expect(readSrc("bot-actor.ts")).toMatch(/readDocument/);
    expect(readSrc("bot-office-tools.ts")).toMatch(/isFailedToolValue/);
    expect(readSrc("bot-knowledge.ts")).toMatch(/inbox\/invoice\.pdf/);
    expect(readSrc("bot-knowledge.ts")).toMatch(/readComputer/);
    expect(readSrc("bot-actor.ts")).toMatch(/readFileBytes/);
    expect(readSrc("worker.ts")).toMatch(/bindToMarkdown\(env\.AI\)/);
  });

  it("loads gadgets at the host Worker compatibility date", () => {
    const wrangler = readFileSync(join(src, "../wrangler.jsonc"), "utf8");
    const date = wrangler.match(/"compatibility_date":\s*"([^"]+)"/)?.[1];
    expect(date).toBeTruthy();
    const runtime = readSrc("app-runtime-do.ts");
    expect(runtime).toContain(`compatibilityDate: "${date}"`);
    expect(runtime).toMatch(/claimed !== workspaceId/);
    expect(runtime).toMatch(/storage\.put\("initialized", true\)/);
    expect(runtime).toMatch(/facets\.delete\("gadget"\)/);
  });

  it("binds ROOM_ACTOR to the provisioned BotActor class", () => {
    const wrangler = readFileSync(join(src, "../wrangler.jsonc"), "utf8");
    expect(wrangler).toMatch(/"name": "ROOM_ACTOR"/);
    expect(wrangler).toMatch(/"class_name": "BotActor"/);
    expect(wrangler).not.toMatch(/"tag": "v3"/);
    expect(wrangler).not.toMatch(/"deleted_classes"/);
    expect(wrangler).not.toMatch(/"experimental"/);
    expect(readSrc("worker.ts")).toMatch(/RoomActor as BotActor/);
    expect(readSrc("worker.ts")).not.toMatch(/addBotMcp/);
    expect(readSrc("worker.ts")).not.toMatch(/probeBotMcp/);
    expect(readSrc("mcp.ts")).toMatch(/connectMcpHttp/);
    expect(readSrc("mcp.ts")).not.toMatch(/getMcpHostBot/);
    expect(readSrc("mcp-http.ts")).toMatch(/StreamableHTTPClientTransport/);
    expect(readSrc("mcp-http.ts")).toMatch(/class CatalogMcpOAuthProvider/);
    expect(readSrc("mcp-http.ts")).not.toMatch(/from ["']agents["']/);
    expect(readSrc("mcp-http.ts")).not.toMatch(
      /DurableObjectOAuthClientProvider/,
    );
    expect(readSrc("bots.ts")).not.toMatch(/getMcpHostBot/);
  });

  it("tells Code Mode not to treat a firing as a create", () => {
    const connector = readSrc("bot-routines-connector.ts");
    expect(connector).toMatch(/Create or edit only when a human asks/);
    expect(connector).toMatch(/name is a short label/);
    expect(connector).toMatch(/Run now — scheduled job/);
    expect(connector).toMatch(/Do not call create, update, or run/);
    expect(connector).not.toMatch(
      /Use when someone asks you to do something on a schedule/,
    );
    expect(readSrc("bot-actor.ts")).toMatch(/formatRoutinePrompt/);
  });

  it("does not depend on @cloudflare/shell", () => {
    const pkg = JSON.parse(
      readFileSync(join(src, "../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).not.toHaveProperty("@cloudflare/shell");
  });
});
