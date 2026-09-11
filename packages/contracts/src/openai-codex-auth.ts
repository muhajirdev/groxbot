/** Workspace env overlay for a pasted Codex / Pi ChatGPT OAuth credential. */
export const OPENAI_CODEX_AUTH_ENV = "GROXBOT_OPENAI_CODEX_AUTH" as const;

const JWT_AUTH_CLAIM = "https://api.openai.com/auth";

/** Canonical ChatGPT Plus/Pro (Codex) OAuth blob stored in Settings. */
export type OpenAiCodexAuth = {
  type: "oauth";
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
};

export type ParseOpenAiCodexAuthResult =
  | { ok: true; auth: OpenAiCodexAuth }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) return null;
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function accountIdFromAccess(access: string): string | undefined {
  const payload = decodeJwtPayload(access);
  const auth = asRecord(payload?.[JWT_AUTH_CLAIM]);
  const id = asString(auth?.chatgpt_account_id);
  return id || undefined;
}

function expiresFromAccess(access: string): number {
  return expiresFrom(decodeJwtPayload(access)?.exp);
}

function expiresFrom(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber;
    }
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function credentialFrom(
  access: string,
  refresh: string,
  expires: number,
  accountId?: string,
): ParseOpenAiCodexAuthResult {
  if (refresh.length < 20) {
    return {
      ok: false,
      error: "That ChatGPT login is missing a refresh token. Paste ~/.codex/auth.json after `codex login`.",
    };
  }
  const fromJwt = access ? accountIdFromAccess(access) : undefined;
  const jwtExpires = access ? expiresFromAccess(access) : 0;
  const auth: OpenAiCodexAuth = {
    type: "oauth",
    access,
    refresh,
    expires: jwtExpires || (access ? expires : 0),
    accountId: accountId || fromJwt,
  };
  return { ok: true, auth };
}

function fromPiCredential(
  value: Record<string, unknown>,
): ParseOpenAiCodexAuthResult | null {
  const refresh = asString(value.refresh ?? value.refresh_token);
  if (!refresh) return null;
  const access = asString(value.access ?? value.access_token);
  const accountId = asString(value.accountId ?? value.account_id);
  return credentialFrom(access, refresh, expiresFrom(value.expires), accountId);
}

function fromCodexTokens(
  tokens: Record<string, unknown>,
  accountId?: string,
  lastRefresh?: unknown,
): ParseOpenAiCodexAuthResult {
  const refresh = asString(tokens.refresh_token ?? tokens.refresh);
  const access = asString(tokens.access_token ?? tokens.access);
  return credentialFrom(
    access,
    refresh,
    expiresFrom(lastRefresh),
    accountId || asString(tokens.account_id ?? tokens.accountId),
  );
}

/**
 * Accept Codex CLI `~/.codex/auth.json`, Pi `~/.pi/agent/auth.json`, or the
 * `openai-codex` OAuth object those files contain.
 */
export function parseOpenAiCodexAuth(raw: string): ParseOpenAiCodexAuthResult {
  const value = raw.trim();
  if (!value) {
    return {
      ok: false,
      error: "Paste ~/.codex/auth.json from a machine where you ran `codex login`.",
    };
  }
  if (value.includes("•") || value.includes("…")) {
    return {
      ok: false,
      error: "That looks like a hint, not the auth file. Paste the full JSON.",
    };
  }
  if (value.startsWith("sk-")) {
    return {
      ok: false,
      error: "That is an API key. ChatGPT / Codex needs ~/.codex/auth.json from `codex login`.",
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {
      ok: false,
      error: "Paste the JSON from ~/.codex/auth.json or ~/.pi/agent/auth.json.",
    };
  }
  const root = asRecord(parsed);
  if (!root) {
    return { ok: false, error: "That auth file is not a JSON object." };
  }

  const nested = asRecord(root["openai-codex"]);
  if (nested) {
    const fromNested = fromPiCredential(nested);
    if (fromNested) return fromNested;
  }

  const asPi = fromPiCredential(root);
  if (asPi?.ok) return asPi;

  const tokens = asRecord(root.tokens);
  if (tokens) {
    return fromCodexTokens(
      tokens,
      asString(root.account_id ?? root.accountId),
      root.last_refresh ?? root.expires,
    );
  }

  if (asString(root.refresh_token) || asString(root.access_token)) {
    return fromCodexTokens(
      root,
      asString(root.account_id ?? root.accountId),
      root.last_refresh ?? root.expires,
    );
  }

  return {
    ok: false,
    error:
      "That JSON has no ChatGPT refresh token. Paste ~/.codex/auth.json after `codex login`, or the openai-codex entry from ~/.pi/agent/auth.json.",
  };
}

export function packOpenAiCodexAuth(auth: OpenAiCodexAuth): string {
  const packed: OpenAiCodexAuth = {
    type: "oauth",
    access: auth.access,
    refresh: auth.refresh,
    expires: auth.expires,
  };
  if (auth.accountId) packed.accountId = auth.accountId;
  return JSON.stringify(packed);
}

export function openAiCodexHint(auth: OpenAiCodexAuth): string {
  const id = auth.accountId?.trim();
  if (id && id.length >= 4) return `••••${id.slice(-4)}`;
  return "ChatGPT connected";
}
