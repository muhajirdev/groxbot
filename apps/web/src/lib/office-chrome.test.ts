import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(root, "../styles.css"), "utf8");
const threadAui = readFileSync(
  join(root, "../components/assistant-ui/elements/thread.aui.tsx"),
  "utf8",
);
const chatScreen = readFileSync(join(root, "../screens/Chat.tsx"), "utf8");

function rootBlock(marker: string): string {
  const start = css.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  return css.slice(open, close);
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match?.[1], name).toBeTruthy();
  return match?.[1]?.trim() ?? "";
}

function gray(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
  return parseInt(hex.slice(1, 3), 16);
}

describe("office chrome", () => {
  const dark = rootBlock(":root {\n  color-scheme: dark;");
  const light = rootBlock(':root[data-theme="light"] {');

  it("keeps a black gutter around one office panel", () => {
    expect(token(dark, "--bg")).toBe("#000000");
    expect(token(dark, "--bg-side")).toBe("#161616");
    expect(token(dark, "--bg-side")).toBe(token(dark, "--bg-thread"));
    expect(gray(token(dark, "--bg-side"))).toBeGreaterThan(gray(token(dark, "--bg")));
    expect(css).toMatch(/\.chat-side\s*\{[^}]*background:\s*var\(--bg-side\)/s);
  });

  it("lifts the light panel off the gray gutter", () => {
    expect(token(light, "--bg")).toBe("#f2f2f2");
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
    expect(css).toMatch(/\.chat-shell\s*\{[^}]*padding:\s*10px;/s);
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*border:\s*1px solid var\(--line\);[^}]*border-radius:\s*var\(--radius-shell\)/s,
    );
    expect(css).toMatch(
      /\.chat-panel\s*\{[^}]*grid-template-columns:\s*var\(--side-width, 240px\)/s,
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

  it("aligns the computer bar with the thread head", () => {
    expect(css).toMatch(/\.pane-head\s*\{[^}]*min-height:\s*45px/s);
    expect(css).toMatch(/\.thread-head\s*\{[^}]*min-height:\s*45px/s);
  });
});
