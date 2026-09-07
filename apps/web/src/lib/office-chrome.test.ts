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
const chatScreen = readFileSync(join(root, "../screens/Chat.tsx"), "utf8");
const computerPane = readFileSync(
  join(root, "../components/ComputerPane.tsx"),
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
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

describe("office chrome", () => {
  const dark = rootBlock(":root {\n  color-scheme: dark;");
  const light = rootBlock(':root[data-theme="light"] {');

  it("keeps a dark gutter around one office panel", () => {
    expect(token(dark, "--bg")).toBe("#08090a");
    expect(token(dark, "--bg-side")).toBe("#0f1011");
    expect(token(dark, "--bg-side")).toBe(token(dark, "--bg-thread"));
    expect(gray(token(dark, "--bg-side"))).toBeGreaterThan(gray(token(dark, "--bg")));
    expect(css).toMatch(/\.chat-side\s*\{[^}]*background:\s*var\(--bg-side\)/s);
  });

  it("lifts the light panel off the cool gutter", () => {
    expect(token(light, "--bg")).toBe("#eceef2");
    expect(token(light, "--bg-thread")).toBe("#ffffff");
    expect(token(light, "--bg-side")).toBe(token(light, "--bg-thread"));
    expect(token(light, "--bg-thread")).not.toBe(token(light, "--bg"));
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

  it("insets one rounded panel with a hairline on all four sides", () => {
    expect(token(dark, "--radius-shell")).toBe("12px");
    expect(css).toMatch(/\.chat-shell\s*\{[^}]*padding:\s*12px 16px;/s);
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*var\(--radius-shell\)/s,
    );
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*grid-template-columns:\s*var\(--side-width, 240px\)/s,
    );
  });

  it("lets an office look beat the light theme tokens", () => {
    const light = css.indexOf(':root[data-theme="light"] {');
    const snow = css.indexOf(':root[data-office-color="snow"] {');
    expect(light).toBeGreaterThan(-1);
    expect(snow).toBeGreaterThan(light);
    expect(css).toMatch(
      /:root\[data-office-color="night"\]\s*\{[^}]*--bg-side:\s*#0c152c/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="snow"\]\s*\{[^}]*--bg-side:\s*#ffffff/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="paper"\]\s*\{[^}]*--bg-side:\s*#f7f0e4/s,
    );
    expect(css).toMatch(
      /:root\[data-office-color="blush"\]\s*\{[^}]*--bg-side:\s*#f3c2d2/s,
    );
  });

  it("keeps night type readable on the navy shell", () => {
    const night = rootBlock(':root[data-office-color="night"] {');
    const side = token(night, "--bg-side");
    const card = token(night, "--card");
    expect(side).toBe("#0c152c");
    expect(contrast(token(night, "--ink"), side)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(night, "--muted"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--muted"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--accent"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, "--danger"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(dark, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(night, "--line"), side)).toBeLessThan(2);
  });

  it("keeps snow type readable on the white shell", () => {
    const snow = rootBlock(':root[data-office-color="snow"] {');
    const side = token(snow, "--bg-side");
    const card = token(snow, "--card");
    expect(side).toBe("#ffffff");
    expect(contrast(token(snow, "--ink"), side)).toBeGreaterThanOrEqual(7);
    expect(contrast(token(snow, "--muted"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--muted"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--accent"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--danger"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(snow, "--line"), side)).toBeLessThan(2);
  });

  it("keeps every office look readable", () => {
    for (const color of OFFICE_COLORS) {
      const block = rootBlock(`:root[data-office-color="${color.id}"] {`);
      const side = token(block, "--bg-side");
      const card = token(block, "--card");
      const danger =
        readToken(block, "--danger") ??
        token(color.theme === "light" ? light : dark, "--danger");
      expect(side, color.id).toBe(color.swatch);
      expect(contrast(token(block, "--ink"), side), color.id).toBeGreaterThanOrEqual(7);
      if (color.id === "paper") continue;
      expect(contrast(token(block, "--muted"), side), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--muted"), card), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--accent"), side), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(danger, side), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(danger, card), color.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(block, "--line"), side), color.id).toBeLessThan(2);
    }
  });

  it("keeps paper danger readable on the cream shell", () => {
    const paper = rootBlock(':root[data-office-color="paper"] {');
    const side = token(paper, "--bg-side");
    const card = token(paper, "--card");
    expect(contrast(token(paper, "--danger"), side)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(paper, "--danger"), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token(light, "--danger"), token(light, "--bg-side"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("fits four office places in the dock", () => {
    expect(css).toMatch(
      /\.chat-dock\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s,
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
      /\.knowledge-peek-body \.knowledge-preview-head\s*\{[^}]*padding:\s*8px 14px/s,
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
    expect(gray(token(dark, "--selected"))).toBe(gray(token(dark, "--card")));
    expect(css).toMatch(
      /\.command-palette \[role="option"\]\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--card-2\)/s,
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

  it("gives sidebar bot rows a 36px face", () => {
    expect(chatScreen).toMatch(/grid-cols-\[36px_minmax\(0,1fr\)\]/);
    expect(chatScreen).toMatch(/size="md"/);
    expect(css).toMatch(/\.member-stack\s*\{[^}]*width:\s*36px/s);
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
    expect(css).toMatch(/\.aui-root\s*\{[^}]*--color-muted:\s*var\(--hover\)/s);
  });

  it("paints a filed review as a Filed note, not a chat bubble", () => {
    expect(threadAui).toMatch(/data-slot="office-learned"/);
    expect(threadAui).toMatch(/>Filed</);
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

  it("keeps Send available while a turn is running", () => {
    const actions = threadAui.slice(
      threadAui.indexOf("const ComposerAction"),
      threadAui.indexOf("const MessageError"),
    );
    expect(actions).toContain("ComposerPrimitive.Send");
    expect(actions).not.toMatch(
      /AuiIf condition=\{\(s\) => !s\.thread\.isRunning && !pending\}/,
    );
    expect(actions).toContain("Stop now");
  });

  it("keeps halt on the composer, not the thread head", () => {
    expect(chatScreen).not.toContain("Stop now");
    expect(threadAui).toContain("Stop now");
  });

  it("keeps roster sections as small caps labels", () => {
    const header = chatScreen.slice(
      chatScreen.indexOf("const SectionHeader"),
      chatScreen.indexOf("export function Chat"),
    );
    expect(header).toMatch(/text-\[11px\]/);
    expect(header).toMatch(/uppercase/);
    expect(header).not.toMatch(/text-\[12px\]/);
    expect(header).not.toMatch(/text-\[13px\]/);
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

  it("keeps settings field controls inside the pane", () => {
    expect(css).toMatch(/\.field\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(
      /\.field input,\s*\.field textarea,\s*\.field select\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s,
    );
    expect(css).toMatch(/\.pane-scroll\s*\{[^}]*min-width:\s*0/s);
  });

  it("aligns the computer bar with the thread head", () => {
    expect(css).toMatch(/\.pane-head\s*\{[^}]*min-height:\s*45px/s);
    expect(css).toMatch(/\.thread-head\s*\{[^}]*min-height:\s*45px/s);
  });

  it("toasts share and copy from the bottom right", () => {
    expect(css).toMatch(/\.office-toasts\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/\.office-toasts\s*\{[^}]*right:/s);
    expect(css).toMatch(/\.office-toast\s*\{[^}]*background:\s*var\(--card\)/s);
    expect(css).toMatch(/@keyframes office-toast-in/);
  });
});
