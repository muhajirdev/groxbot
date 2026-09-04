import { describe, expect, it } from "vitest";
import {
  parseTinyfishKeys,
  runTinyfishFetch,
  runTinyfishSearch,
  TINYFISH_FETCH_URL,
  TINYFISH_SEARCH_URL,
  TinyfishKeyPool,
  tinyfishConfigured,
  tinyfishPoolStart,
} from "./tinyfish.js";

describe("parseTinyfishKeys", () => {
  it("splits a comma pool and keeps a single key", () => {
    expect(parseTinyfishKeys("tf-a, tf-b;tf-a\ntf-c")).toEqual([
      "tf-a",
      "tf-b",
      "tf-c",
    ]);
    expect(
      parseTinyfishKeys({
        TINYFISH_API_KEY: "tf-one",
        TINYFISH_API_KEYS: "tf-two, tf-three",
      }),
    ).toEqual(["tf-two", "tf-three", "tf-one"]);
  });
});

describe("TinyfishKeyPool", () => {
  it("round-robins and seeds the start slot", () => {
    const pool = new TinyfishKeyPool(["a", "b", "c"], 1);
    expect(pool.take()).toBe("b");
    expect(pool.take()).toBe("c");
    expect(pool.take()).toBe("a");
    expect(tinyfishPoolStart("room-1", 3)).toBe(
      tinyfishPoolStart("room-1", 3),
    );
    expect(tinyfishPoolStart("room-1", 3)).not.toBe(
      tinyfishPoolStart("room-2", 3),
    );
  });
});

describe("tinyfishConfigured", () => {
  it("needs a non-empty key", () => {
    expect(tinyfishConfigured(undefined)).toBe(false);
    expect(tinyfishConfigured("  ")).toBe(false);
    expect(tinyfishConfigured("tf-test")).toBe(true);
    expect(tinyfishConfigured(["tf-a", "tf-b"])).toBe(true);
  });
});

describe("runTinyfishSearch", () => {
  it("asks TinyFish with the API key and returns ranked hits", async () => {
    let seen: { url: string; key: string } | undefined;
    const result = await runTinyfishSearch({
      query: "web automation tools",
      purpose: "Find agent search APIs",
      apiKey: "tf-test",
      fetch: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        seen = { url, key: headers.get("X-API-Key") ?? "" };
        return Response.json({
          query: "web automation tools",
          results: [
            {
              position: 1,
              site_name: "tinyfish.ai",
              title: "TinyFish Search",
              snippet: "Structured web search.",
              url: "https://tinyfish.ai/search",
            },
            { title: "Skip me" },
          ],
        });
      },
    });
    expect(seen?.key).toBe("tf-test");
    expect(seen?.url).toContain(TINYFISH_SEARCH_URL);
    expect(seen?.url).toContain("query=web");
    expect(seen?.url).toContain("purpose=");
    expect(result).toEqual({
      ok: true,
      query: "web automation tools",
      results: [
        {
          position: 1,
          title: "TinyFish Search",
          snippet: "Structured web search.",
          url: "https://tinyfish.ai/search",
          siteName: "tinyfish.ai",
        },
      ],
    });
  });

  it("fails closed without a key and does not call the network", async () => {
    let called = false;
    const result = await runTinyfishSearch({
      query: "news",
      fetch: async () => {
        called = true;
        return Response.json({});
      },
    });
    expect(called).toBe(false);
    expect(result).toEqual({ ok: false, message: "Web search is not set up." });
  });

  it("skips a 429 onto the next key in the pool", async () => {
    const seen: string[] = [];
    const pool = new TinyfishKeyPool(["tf-a", "tf-b"]);
    const result = await runTinyfishSearch({
      query: "news",
      keys: pool,
      fetch: async (_input, init) => {
        const key = new Headers(init?.headers).get("X-API-Key") ?? "";
        seen.push(key);
        if (key === "tf-a") {
          return Response.json({ message: "rate limited" }, { status: 429 });
        }
        return Response.json({
          query: "news",
          results: [
            {
              title: "Headline",
              snippet: "Today",
              url: "https://example.com/news",
            },
          ],
        });
      },
    });
    expect(seen).toEqual(["tf-a", "tf-b"]);
    expect(result).toMatchObject({ ok: true, query: "news" });
    expect(pool.take()).toBe("tf-a");
  });
});

describe("runTinyfishFetch", () => {
  it("posts the URL and returns markdown", async () => {
    let body = "";
    const result = await runTinyfishFetch({
      url: "https://tinyfish.ai/",
      apiKey: "tf-test",
      fetch: async (input, init) => {
        expect(String(input)).toBe(TINYFISH_FETCH_URL);
        body = String(init?.body ?? "");
        return Response.json({
          results: [
            {
              url: "https://tinyfish.ai/",
              title: "TinyFish",
              text: "# TinyFish\n\nWeb agents.",
            },
          ],
          errors: [],
        });
      },
    });
    expect(JSON.parse(body)).toEqual({
      urls: ["https://tinyfish.ai/"],
      format: "markdown",
    });
    expect(result).toMatchObject({
      ok: true,
      url: "https://tinyfish.ai/",
      contentType: "text/markdown",
      body: "# TinyFish\n\nWeb agents.",
    });
  });

  it("blocks a private URL before TinyFish", async () => {
    let called = false;
    const result = await runTinyfishFetch({
      url: "http://127.0.0.1/secret",
      apiKey: "tf-test",
      fetch: async () => {
        called = true;
        return Response.json({});
      },
    });
    expect(called).toBe(false);
    expect(result).toEqual({
      ok: false,
      message: "That URL is not on the public allowlist.",
    });
  });
});
