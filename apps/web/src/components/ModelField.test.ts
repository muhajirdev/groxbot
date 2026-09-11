import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  type ModelCatalogItem,
  OPENROUTER_PROVIDER,
} from "@groxbot/contracts";
import { describe, expect, it } from "vitest";
import { modelPickerGroups, modelPickerItemMatches } from "./ModelField";

const root = dirname(fileURLToPath(import.meta.url));

const catalog: ModelCatalogItem[] = [
  {
    id: "groxbot/auto",
    label: "Auto",
    provider: CLOUDFLARE_PROVIDER,
    available: true,
  },
  {
    id: "openrouter/deepseek/deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    provider: OPENROUTER_PROVIDER,
    available: false,
  },
];

describe("modelPickerGroups", () => {
  it("groups by provider, then Custom", () => {
    const groups = modelPickerGroups({ catalog });
    expect(groups.map((group) => group.value)).toEqual([
      OPENROUTER_PROVIDER,
      CLOUDFLARE_PROVIDER,
      "__custom",
    ]);
    expect(groups[0]?.label).toBe("OpenRouter");
    expect(groups[1]?.label).toBe("Groxbot");
    expect(groups.at(-1)?.items).toEqual([
      { id: CUSTOM_MODEL_SENTINEL, label: "Custom…" },
    ]);
  });

  it("puts workspace default first when inheriting", () => {
    const groups = modelPickerGroups({
      catalog,
      inherit: { label: "Auto" },
    });
    expect(groups[0]).toEqual({
      value: "__inherit",
      items: [{ id: "", label: "Workspace default (Auto)" }],
    });
  });
});

describe("modelPickerItemMatches", () => {
  const item = {
    id: "groxbot/auto",
    label: "Auto",
    group: "Groxbot",
    available: false,
  };

  it("matches label, id, group, and needs-key", () => {
    expect(modelPickerItemMatches(item, "auto")).toBe(true);
    expect(modelPickerItemMatches(item, "groxbot/")).toBe(true);
    expect(modelPickerItemMatches(item, "grox")).toBe(true);
    expect(modelPickerItemMatches(item, "needs key")).toBe(true);
    expect(modelPickerItemMatches(item, "claude")).toBe(false);
  });
});

describe("model pickers", () => {
  it("use ModelField instead of a native select", () => {
    for (const file of ["AppSettings.tsx", "BotSettingsPane.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).toContain("<ModelField");
      expect(source).not.toMatch(/<select\b/);
      expect(source).toContain("<EffortField");
    }
  });

  it("auto-saves the workspace default model without a Save models click", () => {
    const source = readFileSync(join(root, "AppSettings.tsx"), "utf8");
    expect(source).toContain("persistChoice({ defaultModel: next })");
    expect(source).toContain("persistChoice({ effort: value })");
    expect(source).not.toContain("Save models");
    expect(source).toContain("Save keys");
  });

  it("compacts the desk on a bot model change without a confirm", () => {
    const source = readFileSync(join(root, "BotSettingsPane.tsx"), "utf8");
    expect(source).toContain("compactOffice: true");
    expect(source).not.toContain("Compact this desk");
    expect(source).not.toContain("window.confirm");
  });
});
