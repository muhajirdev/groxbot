import { describe, expect, it } from "vitest";
import {
  isBlockedFetchHost,
  PUBLIC_FETCH_ALLOWLIST,
  runPublicFetch,
  urlMatchesAllowlist,
} from "./public-fetch.js";

describe("urlMatchesAllowlist", () => {
  it("allows public http(s) and blocks private hosts", () => {
    expect(urlMatchesAllowlist("https://example.com/a", PUBLIC_FETCH_ALLOWLIST)).toBe(
      true,
    );
    expect(urlMatchesAllowlist("http://example.com/", PUBLIC_FETCH_ALLOWLIST)).toBe(
      true,
    );
    expect(urlMatchesAllowlist("ftp://example.com/", PUBLIC_FETCH_ALLOWLIST)).toBe(
      false,
    );
    expect(urlMatchesAllowlist("https://127.0.0.1/", PUBLIC_FETCH_ALLOWLIST)).toBe(
      false,
    );
    expect(urlMatchesAllowlist("http://localhost/secret", PUBLIC_FETCH_ALLOWLIST)).toBe(
      false,
    );
    expect(
      urlMatchesAllowlist("https://192.168.1.9/admin", PUBLIC_FETCH_ALLOWLIST),
    ).toBe(false);
    expect(
      urlMatchesAllowlist("https://169.254.169.254/latest", PUBLIC_FETCH_ALLOWLIST),
    ).toBe(false);
  });
});

describe("isBlockedFetchHost", () => {
  it("blocks loopback, RFC1918, link-local, and IPv6 local", () => {
    expect(isBlockedFetchHost("10.0.0.1")).toBe(true);
    expect(isBlockedFetchHost("172.16.4.1")).toBe(true);
    expect(isBlockedFetchHost("::1")).toBe(true);
    expect(isBlockedFetchHost("example.com")).toBe(false);
  });
});

describe("runPublicFetch", () => {
  it("returns the body for a public text response", async () => {
    const result = await runPublicFetch({
      url: "https://example.com/note",
      fetch: async () =>
        new Response("# hi", {
          status: 200,
          headers: { "content-type": "text/markdown" },
        }),
    });
    expect(result).toMatchObject({
      ok: true,
      body: "# hi",
      contentType: "text/markdown",
    });
  });

  it("spills a large body onto the computer", async () => {
    const files = new Map<string, string>();
    const result = await runPublicFetch({
      url: "https://example.com/big",
      maxModelChars: 4,
      spillToWorkspace: true,
      workspace: {
        async mkdir() {},
        async writeFile(path, content) {
          files.set(path, content);
        },
      },
      fetch: async () =>
        new Response("hello world", {
          status: 200,
          headers: { "content-type": "text/plain" },
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toMatch(/^inbox\/fetch\/example.com-/);
    expect(files.get(result.path ?? "")).toBe("hello world");
  });

  it("rejects a private URL before fetch", async () => {
    let called = false;
    const result = await runPublicFetch({
      url: "http://127.0.0.1/secret",
      fetch: async () => {
        called = true;
        return new Response("nope");
      },
    });
    expect(called).toBe(false);
    expect(result).toEqual({
      ok: false,
      message: "That URL is not on the public allowlist.",
    });
  });
});
