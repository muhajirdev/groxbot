import { describe, expect, it } from "vitest";
import { OPENROUTER_PROVIDER } from "@groxbot/contracts";
import {
  clearOpenRouterCatalogCache,
  fetchOpenRouterCatalog,
  mergeOpenRouterIntoCatalog,
  openRouterCatalogId,
  openRouterCatalogLabel,
  parseOpenRouterModelsPayload,
} from "./openrouter-models.js";

describe("openrouter catalog", () => {
  it("prefixes openrouter/ ids and cleans labels", () => {
    expect(openRouterCatalogId("anthropic/claude-sonnet-4.6")).toBe(
      "openrouter/anthropic/claude-sonnet-4.6",
    );
    expect(openRouterCatalogId("openrouter/openai/gpt-4o")).toBe(
      "openrouter/openai/gpt-4o",
    );
    expect(openRouterCatalogLabel({ id: "openai/gpt-4o", name: "OpenAI: GPT-4o" })).toBe(
      "GPT-4o",
    );
  });

  it("parses the public models payload", () => {
    const rows = parseOpenRouterModelsPayload(
      {
        data: [
          { id: "openai/gpt-4o", name: "OpenAI: GPT-4o" },
          { id: "anthropic/claude-sonnet-4.6", name: "Anthropic: Claude Sonnet 4.6" },
          { id: "openai/gpt-4o", name: "dup" },
          { id: "" },
        ],
      },
      true,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.provider === OPENROUTER_PROVIDER)).toBe(true);
    expect(rows.every((row) => row.available)).toBe(true);
    expect(rows.map((row) => row.id).sort()).toEqual([
      "openrouter/anthropic/claude-sonnet-4.6",
      "openrouter/openai/gpt-4o",
    ]);
  });

  it("merges without duplicating curated rows", () => {
    const merged = mergeOpenRouterIntoCatalog(
      [
        {
          id: "openrouter/openai/gpt-4o-mini",
          label: "GPT-4o mini (OpenRouter)",
          provider: OPENROUTER_PROVIDER,
          available: true,
        },
        {
          id: "groxbot/auto",
          label: "Auto",
          provider: "cloudflare",
          available: true,
        },
      ],
      [
        {
          id: "openrouter/openai/gpt-4o-mini",
          label: "GPT-4o Mini",
          provider: OPENROUTER_PROVIDER,
          available: true,
        },
        {
          id: "openrouter/google/gemini-3-flash-preview",
          label: "Gemini 3 Flash Preview",
          provider: OPENROUTER_PROVIDER,
          available: true,
        },
      ],
    );
    expect(merged).toHaveLength(3);
    expect(
      merged.filter((row) => row.id === "openrouter/openai/gpt-4o-mini"),
    ).toHaveLength(1);
    expect(merged.at(-1)?.id).toBe("openrouter/google/gemini-3-flash-preview");
  });

  it("fetches and caches, soft-fails on error", async () => {
    clearOpenRouterCatalogCache();
    let calls = 0;
    const fetchFn = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          data: [{ id: "meta-llama/llama-4-scout", name: "Meta: Llama 4 Scout" }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const first = await fetchOpenRouterCatalog({ fetch: fetchFn, available: true });
    expect(first).toEqual([
      {
        id: "openrouter/meta-llama/llama-4-scout",
        label: "Llama 4 Scout",
        provider: OPENROUTER_PROVIDER,
        available: true,
      },
    ]);
    const second = await fetchOpenRouterCatalog({
      fetch: (async () => {
        calls += 1;
        throw new Error("nope");
      }) as typeof fetch,
      available: false,
    });
    expect(calls).toBe(1);
    expect(second[0]?.available).toBe(false);
    expect(second[0]?.id).toBe("openrouter/meta-llama/llama-4-scout");

    clearOpenRouterCatalogCache();
    await expect(
      fetchOpenRouterCatalog({
        fetch: (async () => {
          throw new Error("offline");
        }) as typeof fetch,
      }),
    ).resolves.toEqual([]);
  });
});
