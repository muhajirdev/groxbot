import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles.css"),
  "utf8",
);

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

describe("office chrome", () => {
  const dark = rootBlock(":root {\n  color-scheme: dark;");
  const light = rootBlock(':root[data-theme="light"] {');

  it("keeps the roster on the same black as the shell", () => {
    expect(token(dark, "--bg")).toBe("#000000");
    expect(token(dark, "--bg-side")).toBe("#000000");
    expect(css).toMatch(/\.chat-side\s*\{[^}]*background:\s*var\(--bg\)/s);
  });

  it("lifts the thread stage off that chrome", () => {
    expect(token(dark, "--bg-thread")).toBe("#161616");
    expect(token(dark, "--bg-thread")).not.toBe(token(dark, "--bg"));
    expect(token(light, "--bg-thread")).toBe("#ffffff");
    expect(token(light, "--bg-thread")).not.toBe(token(light, "--bg"));
  });
});
