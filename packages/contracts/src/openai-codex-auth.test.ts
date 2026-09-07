import { describe, expect, it } from "vitest";
import {
  openAiCodexHint,
  packOpenAiCodexAuth,
  parseOpenAiCodexAuth,
} from "./openai-codex-auth.js";

function jwtWithAccount(accountId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      "https://api.openai.com/auth": { chatgpt_account_id: accountId },
    }),
  ).toString("base64url");
  return `hdr.${payload}.sig`;
}

const refresh = "rt_codex_refresh_token_value_ok";

describe("parseOpenAiCodexAuth", () => {
  it("reads Codex CLI auth.json", () => {
    const access = jwtWithAccount("acct-1234abcd");
    const parsed = parseOpenAiCodexAuth(
      JSON.stringify({
        tokens: {
          id_token: "id",
          access_token: access,
          refresh_token: refresh,
        },
        last_refresh: "2026-01-01T00:00:00.000Z",
        account_id: "acct-1234abcd",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.auth.refresh).toBe(refresh);
    expect(parsed.auth.access).toBe(access);
    expect(parsed.auth.accountId).toBe("acct-1234abcd");
    expect(openAiCodexHint(parsed.auth)).toBe("••••abcd");
  });

  it("reads Pi agent auth.json", () => {
    const parsed = parseOpenAiCodexAuth(
      JSON.stringify({
        "openai-codex": {
          type: "oauth",
          access: "at_live_access_token_value",
          refresh,
          expires: 1_800_000_000_000,
          accountId: "acct-9999",
        },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.auth.accountId).toBe("acct-9999");
    expect(parsed.auth.expires).toBe(1_800_000_000_000);
  });

  it("reads a pasted openai-codex credential object", () => {
    const parsed = parseOpenAiCodexAuth(
      JSON.stringify({
        type: "oauth",
        access: "at_live_access_token_value",
        refresh,
        expires: 0,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(packOpenAiCodexAuth(parsed.auth)).toContain('"refresh"');
  });

  it("rejects API keys and empty JSON", () => {
    expect(parseOpenAiCodexAuth("sk-abcdefghijklmnopqrstuvwxyz").ok).toBe(
      false,
    );
    expect(parseOpenAiCodexAuth("{").ok).toBe(false);
    expect(parseOpenAiCodexAuth(JSON.stringify({ openai: "nope" })).ok).toBe(
      false,
    );
  });
});
