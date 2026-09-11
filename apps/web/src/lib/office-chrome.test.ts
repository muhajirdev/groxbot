import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OFFICE_COLORS } from "./office-color";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const threadAui = readFileSync(
  join(root, "../components/assistant-ui/elements/thread.aui.tsx"),
  "utf8",
);
const toolFallback = readFileSync(
  join(root, "../components/assistant-ui/elements/tool-fallback.aui.tsx"),
  "utf8",
);
const chatScreen = readFileSync(join(root, "../screens/Chat.tsx"), "utf8");
const liveAppsDock = readFileSync(
  join(root, "../components/LiveAppsDock.tsx"),
  "utf8",
);
const icons = readFileSync(join(root, "../components/Icons.tsx"), "utf8");
const computerPane = readFileSync(
  join(root, "../components/ComputerPane.tsx"),
  "utf8",
);
const botSettingsPane = readFileSync(
  join(root, "../components/BotSettingsPane.tsx"),
  "utf8",
);
const appSettings = readFileSync(
  join(root, "../components/AppSettings.tsx"),
  "utf8",
);
const roomBoard = readFileSync(
  join(root, "../components/RoomBoard.tsx"),
  "utf8",
);

function rootBlock(marker: string): string {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  return css.slice(open, close);
}

function readToken(block: string, name: string): string | undefined {
  return block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
}

function token(block: string, name: string): string {
  const value = readToken(block, name);
  expect(value, name).toBeTruthy();
  return value ?? "";
}

function gray(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
  return parseInt(hex.slice(1, 3), 16);
}

function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe("office chrome", () => {
  const dark = rootBlock(":root {\n  color-scheme: dark;");
  const light = rootBlock(':root[data-theme="light"] {');

  it("keeps a dark gutter around the thread card", () => {
    expect(token(dark, "--bg")).toBe("#0d0d0e");
    expect(token(dark, "--bg-side")).toBe(token(dark, "--bg"));
    expect(gray(token(dark, "--bg-thread"))).toBeGreaterThan(gray(token(dark, "--bg")));
    expect(css).toMatch(/\.chat-side\s*\{[^}]*background:\s*transparent/s);
  });

  it("lifts the light panel off the gray gutter", () => {
    expect(token(light, "--bg")).toBe("#f2f1ed");
    expect(token(light, "--bg-thread")).toBe("#fffefa");
    expect(token(light, "--bg-side")).toBe(token(light, "--bg"));
    expect(token(light, "--bg-thread")).not.toBe(token(light, "--bg"));
    expect(token(light, "--accent")).toBe("#3f5f99");
    expect(token(light, "--on-ink")).toBe("#fffefa");
    expect(contrast(token(light, "--ink"), token(light, "--bg-thread"))).toBeGreaterThanOrEqual(7);
    expect(contrast(token(light, "--muted"), token(light, "--bg-thread"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(light, "--accent"), token(light, "--bg-thread"))).toBeGreaterThanOrEqual(4.5);
  });

  it("lifts cards, selection, and hairlines above the panel", () => {
    const canvas = gray(token(dark, "--bg-thread"));
    expect(gray(token(dark, "--hover"))).toBeGreaterThan(canvas);
    expect(gray(token(dark, "--bg-pane"))).toBeGreaterThan(canvas);
    expect(gray(token(dark, "--card"))).toBeGreaterThan(canvas);
    expect(gray(token(dark, "--selected"))).toBeGreaterThan(
      gray(token(dark, "--bg-side")),
    );
    expect(gray(token(dark, "--card-2"))).toBeGreaterThan(gray(token(dark, "--card")));
    expect(gray(token(dark, "--line"))).toBeGreaterThan(canvas);
  });

  it("rounds the thread as the shell, not the roster", () => {
    expect(token(dark, "--radius-shell")).toBe("20px");
    expect(css).toMatch(/\.chat-shell\s*\{[^}]*padding:\s*0;/s);
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0/s,
    );
    expect(css).toMatch(
      /\.chat-stage\s*\{[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*var\(--radius-shell\)/s,
    );
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*color:\s*var\(--ink\)/s);
    expect(css).toMatch(/\.chat-stage\s*\{[^}]*corner-shape:\s*squircle/s);
    expect(css).toMatch(
      /\.knowledge-place\s*\{[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*var\(--radius-shell\)/s,
    );
    expect(css).toMatch(/\.knowledge-place\s*\{[^}]*color:\s*var\(--ink\)/s);
    expect(css).toMatch(
      /\.knowledge-place\s*\{[^}]*corner-shape:\s*squircle/s,
    );
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*grid-template-columns:\s*var\(--side-width, 240px\)/s,
    );
  });

  it("uses continuous squircle corners for composers", () => {
    expect(css).toMatch(/\.corner-squircle\s*\{[^}]*corner-shape:\s*squircle/s);
    expect(threadAui).toContain('["--composer-radius" as string]: "2rem"');
    expect(threadAui).toMatch(
      /data-slot="aui_composer-shell"[\s\S]*?className="[^"]*corner-squircle/,
    );
    expect(threadAui).toMatch(
      /className="aui-edit-composer-root corner-squircle/,
    );
  });

  it("frames clay bot avatars as squircles", () => {
    expect(css).toMatch(
      /\.clay-avatar\s*\{[^}]*border-radius:\s*32%;[^}]*corner-shape:\s*squircle/s,
    );
  });

  it("lets an office look beat the light theme tokens", () => {
    const light = css.indexOf(':root[data-theme="light"] {');
    const snow = css.indexOf(':root[data-office-color="snow"] {');
    expect(light).toBeGreaterThan(-1);
    expect(snow).toBeGreaterThan(light);
    expect(css).toMatch(
      /:root\[data-office-color="night"\]\s*\{[^}]*--bg-thread:\s*#0c152c/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="linear"\]\s*\{[^}]*--bg-thread:\s*#131315/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="snow"\]\s*\{[^}]*--bg-thread:\s*#fffefa/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="paper"\]\s*\{[^}]*--bg-thread:\s*#f7f0e4/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="blush"\]\s*\{[^}]*--bg-thread:\s*#f3c2d2/s,
    );
  });

  it("keeps night type readable on the navy shell", () => {
    const night = rootBlock(':root[data-office-color="night"] {');
    const gutter = token(night, "--bg");
    const thread = token(night, "--bg-thread");
    const card = token(night, "--card");
    expect(gutter).toBe("#060a18");
    expect(thread).toBe("#0c152c");
    expect(contrast(token(night, "--ink"), gutter)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(night, "--ink"), thread)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(night, "--muted"), gutter)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--muted"), thread)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--muted"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--accent"), gutter)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, "--danger"), gutter)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--line"), thread)).toBeLessThan(2);
  });

  it("keeps the full light theme readable", () => {
    const snow = rootBlock(':root[data-office-color="snow"] {');
    const gutter = token(snow, "--bg");
    const thread = token(snow, "--bg-thread");
    const card = token(snow, "--card");
    expect(gutter).toBe("#f2f1ed");
    expect(token(snow, "--bg-side")).toBe(gutter);
    expect(thread).toBe("#fffefa");
    expect(contrast(token(snow, "--ink"), thread)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(snow, "--ink"), gutter)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(snow, "--muted"), thread)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--muted"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--muted"), gutter)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--accent"), thread)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--accent"), gutter)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--danger"), thread)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--line"), thread)).toBeLessThan(2);
    expect(token(snow, "--ok")).toBe("#176b45");
    expect(token(snow, "--shadow")).toContain("rgba(40, 36, 28, 0.12)");
    expect(css).not.toContain(':root[data-office-color="snow"] .chat-side');
  });

  it("keeps every office look readable", () => {
    for (const color of OFFICE_COLORS) {
      const block = rootBlock(`:root[data-office-color="${color.id}"] {`);
      const gutter = token(block, "--bg");
      const thread = token(block, "--bg-thread");
      const card = token(block, "--card");
      const danger =
        readToken(block, "--danger") ??
        token(color.theme === "light" ? light : dark, "--danger");
      expect(thread, color.id).toBe(color.swatch);
      expect(token(block, "--bg"), color.id).toBe(color.rail);
      expect(token(block, "--bg-side"), color.id).toBe(gutter);
      expect(contrast(token(block, "--ink"), thread), color.id).toBeGreaterThanOrEqual(7);
      expect(contrast(token(block, "--ink"), gutter), color.id).toBeGreaterThanOrEqual(4.5);
      if (color.id === "paper") continue;
      expect(contrast(token(block, "--muted"), thread), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--muted"), card), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(danger, card), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--line"), thread), color.id).toBeLessThan(2);
      if (color.id === "blush") continue;
      expect(contrast(token(block, "--muted"), gutter), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--accent"), gutter), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(danger, gutter), color.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps paper danger readable on the cream shell", () => {
    const paper = rootBlock(':root[data-office-color="paper"] {');
    const card = token(paper, "--card");
    expect(contrast(token(paper, "--danger"), token(paper, "--bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(paper, "--danger"), token(paper, "--bg-thread"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(paper, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(light, "--danger"), token(light, "--bg"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("fits four office places in the dock", () => {
    expect(css).toMatch(
      /\.chat-dock\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s,
    );
    expect(css).toMatch(
      /\.chat-foot\s*\{[^}]*margin-inline:\s*-8px;[^}]*border-top:\s*1px solid color-mix\(in srgb, var\(--ink\) 12%, transparent\)/s,
    );
    expect(css).not.toMatch(
      /\.chat-panel \.thread-head,\s*\n\s*\.chat-panel \.chat-foot/,
    );
    expect(css).toMatch(
      /\.chat-dock-item\[aria-current="page"\],\s*\n\s*\.chat-dock-item\[aria-pressed="true"\]\s*\{[^}]*color:\s*var\(--ink\)/s,
    );
    expect(css).not.toMatch(
      /\.chat-dock-item\[aria-current="page"\][^}]*color:\s*var\(--accent\)/s,
    );
    expect(css).toMatch(/\.chat-dock-item\s*\{[^}]*outline:\s*none/s);
  });

  it("animates dock icons through idle hover and click", () => {
    expect(css).toMatch(/@keyframes ico-idle-sway/);
    expect(css).toMatch(/@keyframes ico-pin/);
    expect(css).toMatch(/@keyframes ico-click/);
    expect(css).toMatch(/\.chat-dock-item:hover \.ico-knowledge \.sprout/);
    expect(css).toMatch(/\.chat-dock-item\[data-clicked\] \.office-ico/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*\.office-ico/s,
    );
    expect(chatScreen).toMatch(/function DockItem/);
    expect(chatScreen).toMatch(/function YouRow/);
    expect(chatScreen).toMatch(/useIconPress/);
    expect(chatScreen).toMatch(/useDockLabelsHidden/);
    expect(icons).toMatch(/className=\{cn\("office-ico"/);
    expect(icons).toMatch(/kind="caret"/);
    expect(css).toMatch(/\.chat-you:hover \.ico-caret \.caret-up/);
    expect(css).toMatch(
      /\.aui-composer-send:hover:not\(:disabled\)\s*\{[^}]*transform:\s*scale\(1\.05\)/s,
    );
    expect(threadAui).toMatch(/active:scale-100/);
  });

  it("snaps the roster to an icon rail when dragged past names", () => {
    expect(chatScreen).toMatch(/is-side-rail/);
    expect(chatScreen).toMatch(/isSideRail/);
    expect(chatScreen).toMatch(/SIDE_WIDTH_RAIL/);
    expect(chatScreen).toMatch(/side-head/);
    expect(chatScreen).toMatch(/chat-roster/);
    expect(css).toMatch(
      /\.chat-shell\.is-side-rail \.side-head/,
    );
    expect(css).toMatch(
      /\.chat-shell\.is-side-rail \.chat-foot/,
    );
    expect(css).toMatch(
      /\.chat-shell\.is-side-rail \.chat-conv\s*\{[^}]*padding-inline:\s*14px/s,
    );
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*transition:\s*grid-template-columns/s,
    );
    expect(css).not.toMatch(/workspace-switcher-mark/);
  });

  it("lists live apps from a dock dialog, not the roster", () => {
    expect(chatScreen).toMatch(/LiveAppsDock/);
    expect(chatScreen).not.toMatch(/function AppRow/);
    expect(liveAppsDock).toMatch(/aria-haspopup="dialog"/);
    expect(liveAppsDock).toMatch(/ModalShell/);
    expect(chatScreen).toMatch(/is-app-full/);
    expect(chatScreen).toMatch(/onToggleFull/);
    expect(css).toMatch(/@keyframes apps-dock-pulse/);
    expect(css).toMatch(
      /\.chat-shell\.is-app-full \.chat-stage\s*\{[^}]*margin:\s*8px 12px 12px/s,
    );
  });

  it("lets the office pane share one resizable column", () => {
    expect(css).toMatch(
      /\.chat-shell\.is-pane \.chat-stage\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) var\(--pane-width, 380px\)/,
    );
    expect(css).toMatch(/\.pane-resize\s*\{[^}]*cursor:\s*col-resize/s);
    expect(css).not.toMatch(/46vw/);
    expect(css).toMatch(/\.knowledge-peek \.knowledge-doc\s*\{\s*max-width:\s*none/);
    expect(css).toMatch(
      /\.knowledge-peek-body \.knowledge-preview-head\s*\{[^}]*padding:\s*8px 16px/s,
    );
  });

  it("keeps knowledge on the same plane as the thread", () => {
    expect(css).toMatch(
      /\.knowledge-nav\s*\{[^}]*background:\s*transparent/s,
    );
    expect(css).toMatch(/\.knowledge-preview-body\s*\{[^}]*border:\s*0/s);
    expect(css).toMatch(
      /\.knowledge-preview-body\s*\{[^}]*background:\s*transparent/s,
    );
  });

  it("keeps the knowledge graph on the thread plane", () => {
    expect(css).toMatch(/\.knowledge-graph svg\s*\{[^}]*background:\s*transparent/s);
    expect(css).not.toMatch(
      /\.knowledge-graph svg\s*\{[^}]*radial-gradient/s,
    );
    expect(css).not.toMatch(
      /\.knowledge-graph-node\.selected circle\s*\{[^}]*fill:\s*var\(--accent\)/s,
    );
    expect(css).not.toMatch(/knowledge-graph-arrow/);
  });

  it("lifts the command palette selection off the card", () => {
    expect(gray(token(dark, "--selected"))).toBe(
      gray(token(dark, "--card-2")),
    );
    expect(css).toMatch(
      /\.command-palette \[role="option"\]\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--card-2\)/s,
    );
    expect(css).toMatch(
      /\.chat-conv\.bg-selected\s*\{[^}]*background:\s*var\(--selected\)/s,
    );
    expect(css).not.toMatch(
      /\.chat-conv\.bg-selected\s*\{[^}]*color-mix\(in srgb, var\(--accent\)/s,
    );
  });

  it("keeps the teammate list when knowledge is open", () => {
    expect(css).toMatch(
      /\.chat-shell\.is-library \.chat-stage\s*\{\s*display:\s*none/,
    );
    expect(css).not.toMatch(
      /\.chat-shell\.is-library \.chat-side,\s*\n\s*\.chat-shell\.is-library \.chat-stage/,
    );
  });

  it("gives sidebar bot rows a 44px face", () => {
    expect(chatScreen).toMatch(/grid-cols-\[44px_minmax\(0,1fr\)\]/);
    expect(chatScreen).toMatch(/size="md"/);
    expect(css).toMatch(/\.member-stack\s*\{[^}]*width:\s*44px/s);
    expect(css).toMatch(/\.chat-conv\s*\{[^}]*corner-shape:\s*squircle/s);
  });

  it("keeps phone roster time off the more menu", () => {
    expect(chatScreen).toMatch(/chat-conv[^"]*max-\[720px\]:pr-12/);
    expect(chatScreen).toMatch(
      /chat-conv-more[^"]*max-\[720px\]:top-1\/2[^"]*max-\[720px\]:-translate-y-1\/2/,
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\) \{[\s\S]*?\.chat-conv-more\s*\{[^}]*top:\s*50%[^}]*translateY\(-50%\)/,
    );
  });

  it("scrolls the work board sideways", () => {
    expect(css).toMatch(/\.room-board\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(
      /\.room-board-col\s*\{[^}]*flex:\s*0 0 260px[^}]*background:\s*var\(--card\)/s,
    );
    expect(css).toMatch(
      /\.room-board-card\s*\{[^}]*flex-direction:\s*column/s,
    );
    expect(css).not.toMatch(
      /\.room-board-card\s*\{[^}]*grid-template-columns:\s*44px/s,
    );
    expect(chatScreen).toMatch(
      /InviteFriendButton[\s\S]*?to=\{BOARD_TO\}[\s\S]*?aria-label="Board"/,
    );
    expect(chatScreen).not.toMatch(
      /truncate text-\[14px\] font-semibold">\s*Board/,
    );
  });

  it("lets the work place switch board and list", () => {
    expect(roomBoard).toMatch(/aria-label="Display"/);
    expect(roomBoard).toMatch(/view === "list"/);
    expect(roomBoard).toMatch(/>No tasks</);
    expect(css).toMatch(/\.room-board-list-row\s*\{[^}]*grid-template-columns/s);
    expect(css).toMatch(/\.room-board-display\s*\{[^}]*border:\s*1px solid var\(--line\)/s);
  });

  it("lets a group room invite more teammates", () => {
    expect(chatScreen).toMatch(/aria-label="Invite teammates"/);
    expect(chatScreen).toMatch(/InviteRoomDialog/);
  });

  it("keeps office chrome on an 8px grid", () => {
    expect(css).toMatch(/\.search-field\s*\{[^}]*padding:\s*6px 10px/s);
    expect(css).toMatch(/\.icon-btn\s*\{[^}]*width:\s*28px/s);
    expect(css).toMatch(/\.chat-dock-item\s*\{[^}]*font-size:\s*12px/s);
    expect(chatScreen).toMatch(/px-2 py-2\.5/);
    expect(threadAui).toContain('["--composer-padding" as string]: "8px"');
    expect(threadAui).toMatch(/gap-y-3/);
    expect(threadAui).toMatch(/min-h-9/);
    expect(threadAui).toMatch(/aui-composer-input[^\n]*text-ink/);
    expect(css).toMatch(/\.aui-composer-input\s*\{[^}]*color:\s*var\(--ink\)/s);
  });

  it("paints the assistant-ui canvas with the thread token", () => {
    expect(threadAui).toMatch(
      /className="aui-root aui-thread-root bg-bg-thread /,
    );
    expect(threadAui).toMatch(
      /className="aui-thread-viewport-footer bg-bg-thread /,
    );
    expect(threadAui).not.toMatch(
      /className="aui-root aui-thread-root bg-background /,
    );
  });

  it("paints thread errors in ink, not pale dark-mode red", () => {
    const error = threadAui.slice(
      threadAui.indexOf("const MessageError"),
      threadAui.indexOf("const AssistantWorkingStatus"),
    );
    expect(error).toContain("aui-message-error-root");
    expect(error).not.toContain("dark:text-red-200");
    expect(error).not.toContain("text-destructive");
    expect(css).toMatch(
      /\.aui-message-error-root\s*\{[^}]*color:\s*var\(--ink\)/s,
    );
  });

  it("paints day separators from message createdAt", () => {
    expect(threadAui).toMatch(/data-slot="aui_message-day"/);
    expect(threadAui).toContain("messageDaySep");
    expect(threadAui).toMatch(
      /data-slot="aui_message-day"[\s\S]*?text-muted-foreground/,
    );
    expect(css).toMatch(/\.aui-root\s*\{[^}]*color:\s*var\(--ink\)/s);
    expect(css).toMatch(/\.aui-root\s*\{[^}]*--color-muted:\s*var\(--hover\)/s);
  });

  it("paints a learned review as a Learned note, not a chat bubble", () => {
    expect(threadAui).toMatch(/data-slot="office-learned"/);
    expect(threadAui).toMatch(/>Learned</);
    expect(css).toMatch(/\.office-learned-kicker\s*\{[^}]*color:\s*var\(--accent\)/s);
  });

  it("keeps waiting chrome off the message scope", () => {
    const waiting = threadAui.slice(
      threadAui.indexOf('data-slot="aui_assistant-waiting"'),
      threadAui.indexOf("</AuiIf>", threadAui.indexOf('data-slot="aui_assistant-waiting"')),
    );
    expect(waiting).toContain("<AssistantWorkingStatus />");
    expect(threadAui).toMatch(
      /Do not read `s\.message` — this mounts outside Messages/,
    );
  });

  it("keeps working under the last bubble while tools run", () => {
    expect(threadAui).toMatch(/case "indicator"/);
    expect(threadAui).toMatch(
      /case "indicator"[\s\S]*?data-slot="aui_assistant-working"/,
    );
    expect(threadAui).toContain("assistantTurnHasRunningTool");
    expect(threadAui).toMatch(
      /case "indicator"[\s\S]*if \(toolRunning\) return null/,
    );
    expect(threadAui).not.toContain("AssistantWorkingDots");
  });

  it("always paints reasoning and expandable tool rows", () => {
    expect(threadAui).toMatch(
      /case "tool-call":[\s\S]*ToolFallbackComponent/,
    );
    expect(threadAui).toMatch(
      /reasoning: \["group-chainOfThought", "group-reasoning"\]/,
    );
    expect(threadAui).toMatch(/case "group-chainOfThought"/);
    expect(threadAui).toContain('data-slot="aui_chain-of-thought"');
    expect(threadAui).not.toMatch(
      /data-slot="aui_chain-of-thought"[^>]*className="contents"/,
    );
    expect(threadAui).toMatch(/case "group-reasoning"/);
    expect(threadAui).toMatch(/case "reasoning":/);
    expect(threadAui).toContain("ReasoningRoot");
    expect(threadAui).toContain("ReasoningText");
    expect(threadAui).toContain('data-slot="aui_chain-reasoning"');
    expect(threadAui).not.toMatch(
      /case "group-tool":[\s\S]*if \(!showToolCalls\) return children/,
    );
    expect(threadAui).not.toContain("useShowToolCalls");
    expect(toolFallback).not.toContain("useShowToolCalls");
    expect(toolFallback).not.toContain('data-expandable="false"');
    expect(toolFallback).toContain("toolActivityCopy");
    expect(toolFallback).toContain("isPausedCodeOutput");
    expect(threadAui).toContain('data-slot="office-approvals"');
    expect(toolFallback).not.toContain("Used tool");
  });

  it("keeps chat bubbles free of copy/refresh action bars", () => {
    expect(threadAui).not.toContain("ActionBarPrimitive");
    expect(threadAui).not.toContain("AssistantActionBar");
    expect(threadAui).not.toContain("UserActionBar");
    expect(threadAui).not.toContain("-mb-7.5");
    expect(threadAui).not.toContain("pb-7.5");
  });

  it("merges Stop and Send into one composer slot", () => {
    const actions = threadAui.slice(
      threadAui.indexOf("const composerSlotIsStop"),
      threadAui.indexOf("const MessageError"),
    );
    expect(actions).toContain("ComposerPrimitive.Send");
    expect(actions).toContain("ComposerPrimitive.Cancel");
    expect(actions).toContain("Stop now");
    expect(actions).toContain("composerSlotIsStop");
    expect(actions).toContain("s.composer.text.trim()");
  });

  it("keeps halt on the composer, not the thread head", () => {
    expect(chatScreen).not.toContain("Stop now");
    expect(threadAui).toContain("Stop now");
  });

  it("keeps roster section labels smaller than bot rows", () => {
    const header = chatScreen.slice(
      chatScreen.indexOf("const SectionHeader"),
      chatScreen.indexOf("export function Chat"),
    );
    expect(header).toMatch(/text-\[8px\]/);
    expect(header).not.toMatch(/uppercase/);
    expect(header).not.toMatch(/text-\[9px\]/);
    expect(header).not.toMatch(/text-\[10px\]/);
  });

  it("keeps routines a left-aligned list, not a centered empty-state", () => {
    expect(css).not.toMatch(/\.routines\s*\{[^}]*text-align:\s*center/s);
    expect(css).not.toMatch(/\.routine-toggle\s*\{[^}]*border-radius:\s*99px/s);
    expect(css).not.toMatch(/\.create-routine\s*\{/);
    expect(css).not.toMatch(/\.routine-remove\s*\{/);
    expect(computerPane).toMatch(/className="icon-btn routine-toggle"/);
  });

  it("edits a routine in a sheet with test run and delete", () => {
    expect(computerPane).toContain("Edit Routine");
    expect(computerPane).toContain("Test run");
    expect(computerPane).toContain("Delete");
    expect(computerPane).toContain("openEdit");
    expect(computerPane).not.toMatch(/>\s*Remove\s*</);
  });

  it("gives Appearance its own settings tab", () => {
    expect(appSettings).toMatch(
      /\["appearance", "Appearance"\],\s*\["general", "General"\]/,
    );
    expect(appSettings).toContain("DEFAULT_SETTINGS_TAB");
    expect(appSettings).toContain('export const DEFAULT_SETTINGS_TAB: Tab = "appearance"');
    expect(appSettings).toContain("OfficeLookList");
    expect(appSettings).not.toContain("ThemePicks");
    expect(appSettings).not.toMatch(/group-label">Appearance/);
    expect(appSettings).not.toMatch(/Follow this device/);
    expect(css).not.toMatch(/\.theme-picks\s*\{/);
    expect(css).toMatch(
      /:root\[data-theme="light"\]\[data-office-color="linear"\]\s*\{[^}]*--bg-thread:\s*#fffefa/s,
    );
    expect(css).toMatch(/\.stage-back\s*\{[^}]*background:\s*var\(--overlay\)/s);
  });

  it("uses a short Usage tab on the settings rail", () => {
    expect(appSettings).toMatch(/\["billing", "Usage"\]/);
    expect(appSettings).toContain('billing: "Usage & Billing"');
  });

  it("drills into knowledge on a phone instead of stacking a split pane", () => {
    expect(css).toMatch(
      /\.knowledge-place:not\(\.is-detail\) \.knowledge-preview\s*\{[^}]*display:\s*none/s,
    );
    expect(css).toMatch(
      /\.knowledge-place\.is-detail \.knowledge-nav\s*\{[^}]*display:\s*none/s,
    );
    expect(css).not.toMatch(
      /\.knowledge-split\s*\{[^}]*minmax\(160px, 38%\)/s,
    );
    expect(css).toMatch(/clip:\s*rect\(0, 0, 0, 0\)/);
  });

  it("keeps settings field controls inside the pane", () => {
    expect(css).toMatch(/\.field\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(
      /\.field input,\s*\.field textarea,\s*\.field select\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s,
    );
    expect(css).toMatch(
      /\.field select:focus-visible\s*\{[^}]*border-color:\s*var\(--ink\)/s,
    );
    expect(css).not.toMatch(
      /\.field select:focus[^}]*ring/s,
    );
    expect(css).toMatch(
      /\.field \.combobox-field-input\s*\{[^}]*border:\s*0[^}]*padding:\s*0/s,
    );
    expect(css).toMatch(
      /\.settings-main \.field \.combobox-field-input\s*\{[^}]*background:\s*transparent/s,
    );
    expect(css).toMatch(/\.pane-scroll\s*\{[^}]*min-width:\s*0/s);
  });

  it("lets phone settings delete a teammate with confirm", () => {
    expect(botSettingsPane).toContain("Delete teammate");
    expect(botSettingsPane).toContain("confirmDelete");
    expect(botSettingsPane).toContain("onDelete");
    expect(botSettingsPane).toContain("onArchive");
    expect(chatScreen).toContain("onDelete={(botId) => void deleteTeammate(botId)}");
    expect(chatScreen).toMatch(
      /chat-conv-more[^"]*max-\[720px\]:opacity-100/,
    );
  });

  it("stacks Advanced and Export conversation in teammate settings", () => {
    expect(botSettingsPane).toContain("bot-set-extra");
    expect(botSettingsPane).toContain("bot-set-export");
    expect(css).toMatch(/\.bot-set-extra\s*\{[^}]*display:\s*grid/s);
    expect(css).toMatch(
      /\.bot-set-extra > \.text-btn,\s*\n\s*\.bot-set-export \.text-btn\s*\{[^}]*display:\s*block/s,
    );
  });

  it("aligns the computer bar with the thread head", () => {
    expect(css).toMatch(/\.pane-head\s*\{[^}]*min-height:\s*48px/s);
    expect(css).toMatch(/\.thread-head\s*\{[^}]*min-height:\s*48px/s);
  });

  it("toasts share and copy from the bottom right", () => {
    expect(css).toMatch(/\.office-toasts\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/\.office-toasts\s*\{[^}]*right:/s);
    expect(css).toMatch(/\.office-toast\s*\{[^}]*background:\s*var\(--card\)/s);
    expect(css).toMatch(/@keyframes office-toast-in/);
  });
});
