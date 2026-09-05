import { composioUserId } from "@groxbot/adapter-kit";
import {
  type ConnectedPluginAccount,
  connectedAccountForTool,
} from "@groxbot/core";

export { composioUserId };

export class ComposioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComposioError";
  }
}

export function composioConfigured(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(source.COMPOSIO_API_KEY?.trim());
}

export function requireComposioKey(
  source: NodeJS.ProcessEnv = process.env,
): string {
  const key = source.COMPOSIO_API_KEY?.trim();
  if (!key) {
    throw new ComposioError(
      "COMPOSIO_API_KEY is not set. Add it to the API and worker env, then restart.",
    );
  }
  return key;
}

export function formatComposioResult(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export interface ComposioAccount {
  id: string;
  toolkit: string;
  status: string;
}

export interface ComposioToolHit {
  slug: string;
  name: string;
  description: string;
  toolkit: string;
}

export interface ComposioGateway {
  link(input: {
    userId: string;
    toolkit: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string | null; connectedAccountId?: string }>;
  listAccounts(userId: string): Promise<ComposioAccount[]>;
  getAccount(id: string): Promise<ComposioAccount | undefined>;
  search(input: {
    userId: string;
    query: string;
    toolkits: string[];
  }): Promise<ComposioToolHit[]>;
  execute(input: {
    userId: string;
    slug: string;
    arguments: Record<string, unknown>;
    connectedAccountId?: string;
  }): Promise<unknown>;
  deleteAccount(id: string): Promise<void>;
}

type Sdk = {
  toolkits?: {
    authorize?: (
      userId: string,
      toolkit: string,
      authConfigId?: string,
    ) => Promise<unknown>;
  };
  authConfigs?: {
    list?: (query?: { toolkit?: string }) => Promise<unknown>;
    create?: (toolkit: string, body?: unknown) => Promise<unknown>;
  };
  connectedAccounts?: {
    link?: (
      userId: string,
      authConfigId: string,
      options?: { callbackUrl?: string },
    ) => Promise<unknown>;
    initiate?: (
      userId: string,
      authConfigId: string,
      options?: { callbackUrl?: string },
    ) => Promise<unknown>;
    list?: (query: { userIds: string[] }) => Promise<unknown>;
    get?: (id: string) => Promise<unknown>;
    delete?: (id: string) => Promise<unknown>;
  };
  tools?: {
    getRawComposioTools?: (query: unknown) => Promise<unknown>;
    get?: (userId: string, query: unknown) => Promise<unknown>;
    execute?: (slug: string, body: unknown) => Promise<unknown>;
  };
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toolkitOf(item: unknown): string {
  const row = asRecord(item);
  if (!row) return "";
  const toolkit = asRecord(row.toolkit);
  return readString(
    row.toolkitSlug,
    row.toolkit_slug,
    row.appName,
    typeof row.toolkit === "string" ? row.toolkit : undefined,
    toolkit?.slug,
    toolkit?.name,
  ).toLowerCase();
}

export function slimComposioTools(
  value: unknown,
  toolkits: readonly string[] = [],
): ComposioToolHit[] {
  const allowed = new Set(
    toolkits.map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  const hits: ComposioToolHit[] = [];
  for (const item of itemsOf(value)) {
    const row = asRecord(item);
    const slug = readString(row?.slug, row?.name);
    if (!slug) continue;
    const toolkit = toolkitOf(item);
    if (allowed.size > 0 && toolkit && !allowed.has(toolkit)) continue;
    hits.push({
      slug,
      name: readString(row?.name) || slug,
      description: readString(row?.description, row?.human_description).slice(
        0,
        240,
      ),
      toolkit,
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

function accountOf(item: unknown): ComposioAccount | undefined {
  const row = asRecord(item);
  const id = readString(row?.id, row?.nanoid, row?.connectedAccountId);
  if (!id) return undefined;
  return {
    id,
    toolkit: toolkitOf(item),
    status: readString(row?.status).toUpperCase() || "UNKNOWN",
  };
}

function itemsOf(value: unknown): unknown[] {
  const row = asRecord(value);
  if (Array.isArray(value)) return value;
  if (Array.isArray(row?.items)) return row.items;
  if (Array.isArray(row?.data)) return row.data;
  return [];
}

function redirectOf(value: unknown): {
  redirectUrl: string | null;
  connectedAccountId?: string;
} {
  const row = asRecord(value);
  const redirectUrl =
    readString(row?.redirectUrl, row?.redirect_url, row?.url) || null;
  const connectedAccountId =
    readString(row?.connectedAccountId, row?.id, row?.connected_account_id) ||
    undefined;
  return { redirectUrl, connectedAccountId };
}

export class SdkComposioGateway implements ComposioGateway {
  constructor(private readonly sdk: Sdk) {}

  async link(input: {
    userId: string;
    toolkit: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string | null; connectedAccountId?: string }> {
    const callback = { callbackUrl: input.callbackUrl };
    try {
      const authConfigId = await this.authConfigId(input.toolkit);
      if (this.sdk.connectedAccounts?.link) {
        return redirectOf(
          await this.sdk.connectedAccounts.link(
            input.userId,
            authConfigId,
            callback,
          ),
        );
      }
      if (this.sdk.connectedAccounts?.initiate) {
        return redirectOf(
          await this.sdk.connectedAccounts.initiate(
            input.userId,
            authConfigId,
            callback,
          ),
        );
      }
    } catch {
      // Fall through to toolkit.authorize, which creates an auth config.
    }
    if (this.sdk.toolkits?.authorize) {
      return redirectOf(
        await this.sdk.toolkits.authorize(input.userId, input.toolkit),
      );
    }
    throw new ComposioError("Composio SDK cannot start an OAuth link.");
  }

  async listAccounts(userId: string): Promise<ComposioAccount[]> {
    if (!this.sdk.connectedAccounts?.list) return [];
    return itemsOf(
      await this.sdk.connectedAccounts.list({ userIds: [userId] }),
    ).flatMap((item) => {
      const account = accountOf(item);
      return account ? [account] : [];
    });
  }

  async getAccount(id: string): Promise<ComposioAccount | undefined> {
    if (!this.sdk.connectedAccounts?.get) return undefined;
    return accountOf(await this.sdk.connectedAccounts.get(id));
  }

  async search(input: {
    userId: string;
    query: string;
    toolkits: string[];
  }): Promise<ComposioToolHit[]> {
    const query = {
      search: input.query,
      query: input.query,
      toolkits: input.toolkits,
      limit: input.toolkits.length > 1 ? 24 : 8,
    };
    if (this.sdk.tools?.getRawComposioTools) {
      return slimComposioTools(
        await this.sdk.tools.getRawComposioTools(query),
        input.toolkits,
      );
    }
    if (this.sdk.tools?.get) {
      return slimComposioTools(
        await this.sdk.tools.get(input.userId, query),
        input.toolkits,
      );
    }
    throw new ComposioError("Composio SDK cannot search tools.");
  }

  async execute(input: {
    userId: string;
    slug: string;
    arguments: Record<string, unknown>;
    connectedAccountId?: string;
  }): Promise<unknown> {
    if (!this.sdk.tools?.execute) {
      throw new ComposioError("Composio SDK cannot execute tools.");
    }
    return this.sdk.tools.execute(input.slug, {
      userId: input.userId,
      arguments: input.arguments,
      connectedAccountId: input.connectedAccountId,
      dangerouslySkipVersionCheck: true,
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.sdk.connectedAccounts?.delete?.(id);
  }

  private async authConfigId(toolkit: string): Promise<string> {
    const listed = this.sdk.authConfigs?.list
      ? itemsOf(await this.sdk.authConfigs.list({ toolkit }))
      : [];
    const existing = listed
      .map((item) => readString(asRecord(item)?.id))
      .find(Boolean);
    if (existing) return existing;
    if (!this.sdk.authConfigs?.create) {
      throw new ComposioError(
        `No Composio auth config for ${toolkit}. Create one in the Composio dashboard.`,
      );
    }
    const created = asRecord(
      await this.sdk.authConfigs.create(toolkit, {
        type: "use_composio_managed_auth",
        name: `groxbot-${toolkit}`,
      }),
    );
    const id = readString(
      created?.id,
      created?.nanoid,
      asRecord(created?.auth_config)?.id,
    );
    if (!id)
      throw new ComposioError(`Could not create auth config for ${toolkit}.`);
    return id;
  }
}

const COMPOSIO_API = "https://backend.composio.dev/api/v3";

export class HttpComposioGateway implements ComposioGateway {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async link(input: {
    userId: string;
    toolkit: string;
    callbackUrl: string;
  }): Promise<{ redirectUrl: string | null; connectedAccountId?: string }> {
    const authConfigId = await this.authConfigId(input.toolkit);
    return redirectOf(
      await this.request("/connected_accounts/link", {
        method: "POST",
        body: JSON.stringify({
          auth_config_id: authConfigId,
          user_id: input.userId,
          callback_url: input.callbackUrl,
        }),
      }),
    );
  }

  async listAccounts(userId: string): Promise<ComposioAccount[]> {
    const query = new URLSearchParams({ user_ids: userId });
    return itemsOf(await this.request(`/connected_accounts?${query}`)).flatMap(
      (item) => {
        const account = accountOf(item);
        return account ? [account] : [];
      },
    );
  }

  async getAccount(id: string): Promise<ComposioAccount | undefined> {
    return accountOf(
      await this.request(`/connected_accounts/${encodeURIComponent(id)}`),
    );
  }

  async search(input: {
    userId: string;
    query: string;
    toolkits: string[];
  }): Promise<ComposioToolHit[]> {
    const query = new URLSearchParams({
      query: input.query,
      search: input.query,
      limit: input.toolkits.length > 1 ? "24" : "8",
    });
    const toolkit = input.toolkits[0]?.trim();
    if (toolkit) query.set("toolkit_slug", toolkit);
    return slimComposioTools(
      await this.request(`/tools?${query}`),
      input.toolkits,
    );
  }

  async execute(input: {
    userId: string;
    slug: string;
    arguments: Record<string, unknown>;
    connectedAccountId?: string;
  }): Promise<unknown> {
    return this.request(`/tools/execute/${encodeURIComponent(input.slug)}`, {
      method: "POST",
      body: JSON.stringify({
        user_id: input.userId,
        arguments: input.arguments,
        connected_account_id: input.connectedAccountId,
        dangerously_skip_version_check: true,
      }),
    });
  }

  async deleteAccount(id: string): Promise<void> {
    await this.request(`/connected_accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  private async authConfigId(toolkit: string): Promise<string> {
    const listed = itemsOf(
      await this.request(
        `/auth_configs?toolkit=${encodeURIComponent(toolkit)}`,
      ),
    );
    const existing = listed
      .map((item) =>
        readString(
          asRecord(item)?.id,
          asRecord(item)?.nanoid,
          asRecord(asRecord(item)?.auth_config)?.id,
        ),
      )
      .find(Boolean);
    if (existing) return existing;
    const created = asRecord(
      await this.request("/auth_configs", {
        method: "POST",
        body: JSON.stringify({
          toolkit: { slug: toolkit },
          auth_config: { type: "use_composio_managed_auth" },
        }),
      }),
    );
    const id = readString(
      created?.id,
      created?.nanoid,
      asRecord(created?.auth_config)?.id,
    );
    if (!id) {
      throw new ComposioError(`Could not create auth config for ${toolkit}.`);
    }
    return id;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(`${COMPOSIO_API}${path}`, {
      ...init,
      headers: {
        "x-api-key": this.apiKey,
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { message: text };
      }
    }
    if (!response.ok) {
      const row = asRecord(body);
      const nested = asRecord(row?.error);
      throw new ComposioError(
        readString(row?.message, nested?.message, row?.error) ||
          `Composio request failed (${response.status})`,
      );
    }
    return body;
  }
}

let cached: { key: string; gateway: ComposioGateway } | undefined;

export function createComposioGateway(
  source: NodeJS.ProcessEnv = process.env,
  sdk?: Sdk,
): ComposioGateway {
  if (sdk) return new SdkComposioGateway(sdk);
  const key = requireComposioKey(source);
  if (cached?.key === key) return cached.gateway;
  const gateway = new HttpComposioGateway(key);
  cached = { key, gateway };
  return gateway;
}

export function createPluginTools(input: {
  workspaceId: string;
  toolkits: string[];
  accounts?: readonly ConnectedPluginAccount[];
  env?: NodeJS.ProcessEnv;
}):
  | {
      search: (query: string) => Promise<string>;
      execute: (slug: string, args: Record<string, unknown>) => Promise<string>;
    }
  | undefined {
  const env = input.env ?? process.env;
  const toolkits =
    input.accounts?.map((row) => row.toolkit).filter(Boolean) ?? input.toolkits;
  if (!composioConfigured(env) || toolkits.length === 0) return undefined;
  const gateway = createComposioGateway(env);
  const userId = composioUserId(input.workspaceId);
  const accounts = input.accounts ?? [];
  return {
    search: async (query) =>
      formatComposioResult(await gateway.search({ userId, query, toolkits })),
    execute: async (slug, args) =>
      formatComposioResult(
        await gateway.execute({
          userId,
          slug,
          arguments: args,
          connectedAccountId: connectedAccountForTool(slug, accounts),
        }),
      ),
  };
}
