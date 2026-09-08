import { composioUserId } from "@groxbot/adapter-kit";
import {
  capToolPayload,
  type ConnectedPluginAccount,
  connectedAccountForTool,
  pluginAccountsForTool,
  PLUGIN_SEARCH_FETCH_LIMIT,
  pluginExecuteArguments,
  pluginSearchParams,
  pluginSearchQuery,
  rankPluginHits,
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
  params?: string[];
}

export interface ComposioGateway {
  link(input: {
    userId: string;
    toolkit: string;
    callbackUrl: string;
    alias?: string;
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
      options?: { callbackUrl?: string; allowMultiple?: boolean },
    ) => Promise<unknown>;
    initiate?: (
      userId: string,
      authConfigId: string,
      options?: { callbackUrl?: string; allowMultiple?: boolean },
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

function authConfigIdOf(item: unknown): string {
  const row = asRecord(item);
  return readString(
    row?.id,
    row?.nanoid,
    asRecord(row?.auth_config)?.id,
  );
}

/** Never reuse another toolkit's config (Gmail is often first in an unfiltered list). */
function matchingAuthConfigId(listed: unknown[], toolkit: string): string {
  const wanted = toolkit.trim().toLowerCase();
  const hits: unknown[] = [];
  const unlabeled: unknown[] = [];
  for (const item of listed) {
    const slug = toolkitOf(item);
    if (slug === wanted) hits.push(item);
    else if (!slug) unlabeled.push(item);
  }
  for (const item of hits.length > 0 ? hits : unlabeled) {
    const id = authConfigIdOf(item);
    if (id) return id;
  }
  return "";
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
    const params = toolParamNames(row);
    hits.push({
      slug,
      name: readString(row?.name) || slug,
      description: readString(row?.description, row?.human_description).slice(
        0,
        120,
      ),
      toolkit,
      ...(params.length > 0 ? { params } : {}),
    });
    if (hits.length >= PLUGIN_SEARCH_FETCH_LIMIT) break;
  }
  return hits;
}

function toolParamNames(row: Record<string, unknown> | undefined): string[] {
  const schema = asRecord(row?.input_parameters) ?? asRecord(row?.inputParameters);
  if (!schema) return [];
  const props = asRecord(schema.properties);
  const keys = props
    ? Object.keys(props)
    : Object.keys(schema).filter(
        (key) =>
          !["type", "properties", "required", "additionalProperties"].includes(
            key,
          ),
      );
  return keys.slice(0, 8);
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
    alias?: string;
  }): Promise<{ redirectUrl: string | null; connectedAccountId?: string }> {
    const callback = {
      callbackUrl: input.callbackUrl,
      allowMultiple: true,
    };
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
    const q = pluginSearchQuery(input.query, input.toolkits) || input.query;
    const params = pluginSearchParams(input.query, input.toolkits);
    const query: Record<string, unknown> = {
      toolkits: input.toolkits,
      limit: PLUGIN_SEARCH_FETCH_LIMIT,
      important: true,
    };
    if (params.query) {
      query.search = params.query;
      query.query = params.query;
    }
    if (this.sdk.tools?.getRawComposioTools) {
      return rankPluginHits(
        slimComposioTools(
          await this.sdk.tools.getRawComposioTools(query),
          input.toolkits,
        ),
        q,
      );
    }
    if (this.sdk.tools?.get) {
      return rankPluginHits(
        slimComposioTools(
          await this.sdk.tools.get(input.userId, query),
          input.toolkits,
        ),
        q,
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
      arguments: pluginExecuteArguments(input.slug, input.arguments),
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
    const existing = matchingAuthConfigId(listed, toolkit);
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
    const id = authConfigIdOf(created);
    if (!id)
      throw new ComposioError(`Could not create auth config for ${toolkit}.`);
    return id;
  }
}

const COMPOSIO_API = "https://backend.composio.dev/api/v3";

export class HttpComposioGateway implements ComposioGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly apiKey: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    // Workers `fetch` throws Illegal invocation if called as `this.fetchImpl()`.
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async link(input: {
    userId: string;
    toolkit: string;
    callbackUrl: string;
    alias?: string;
  }): Promise<{ redirectUrl: string | null; connectedAccountId?: string }> {
    const authConfigId = await this.authConfigId(input.toolkit);
    return redirectOf(
      await this.request("/connected_accounts/link", {
        method: "POST",
        body: JSON.stringify({
          auth_config_id: authConfigId,
          user_id: input.userId,
          callback_url: input.callbackUrl,
          allow_multiple: true,
          alias: input.alias,
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
    const q = pluginSearchQuery(input.query, input.toolkits) || input.query;
    const params = pluginSearchParams(input.query, input.toolkits);
    const toolkits = [
      ...new Set(input.toolkits.map((item) => item.trim()).filter(Boolean)),
    ];
    const slugs = toolkits.length > 0 ? toolkits : [""];
    const results = await Promise.allSettled(
      slugs.map((toolkit) => {
        const query = new URLSearchParams({
          important: "true",
          limit: String(PLUGIN_SEARCH_FETCH_LIMIT),
          toolkit_versions: "latest",
        });
        if (params.query) {
          query.set("query", params.query);
          query.set("search", params.query);
        }
        if (toolkit) query.set("toolkit_slug", toolkit);
        return this.request(`/tools?${query}`);
      }),
    );
    const bodies = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (bodies.length === 0) {
      const failed = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (failed) throw failed.reason;
    }
    return rankPluginHits(
      slimComposioTools(
        { items: bodies.flatMap((body) => itemsOf(body)) },
        input.toolkits,
      ),
      q,
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
        arguments: pluginExecuteArguments(input.slug, input.arguments),
        connected_account_id: input.connectedAccountId,
        dangerously_skip_version_check: true,
        version: "latest",
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
        `/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}`,
      ),
    );
    const existing = matchingAuthConfigId(listed, toolkit);
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
    const id = authConfigIdOf(created);
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
  accounts?: readonly {
    id?: string;
    toolkit: string;
    connectedAccountId?: string;
    visibility?: ConnectedPluginAccount["visibility"];
    userId?: string;
  }[];
  env?: NodeJS.ProcessEnv;
}):
  | {
      search: (query: string) => Promise<string>;
      execute: (slug: string, args: Record<string, unknown>) => Promise<string>;
    }
  | undefined {
  const env = input.env ?? process.env;
  const accounts: ConnectedPluginAccount[] = (input.accounts ?? []).map(
    (row, index) => ({
      id: row.id ?? row.connectedAccountId ?? `${row.toolkit}:${index}`,
      toolkit: row.toolkit,
      connectedAccountId: row.connectedAccountId,
      visibility: row.visibility ?? "shared",
      userId: row.userId ?? "",
    }),
  );
  const toolkits = accounts.length
    ? [...new Set(accounts.map((row) => row.toolkit))]
    : input.toolkits;
  if (!composioConfigured(env) || toolkits.length === 0) return undefined;
  const gateway = createComposioGateway(env);
  const userId = composioUserId(input.workspaceId);
  return {
    search: async (query) =>
      formatComposioResult(await gateway.search({ userId, query, toolkits })),
    execute: async (slug, args) => {
      const connectedAccountId = connectedAccountForTool(slug, accounts);
      const matches = pluginAccountsForTool(slug, accounts);
      if (!connectedAccountId && matches.length > 1) {
        throw new ComposioError(
          "Several accounts can run this tool. Pass account from plugins.search.",
        );
      }
      return formatComposioResult(
        await capToolPayload(
          await gateway.execute({
            userId,
            slug,
            arguments: args,
            connectedAccountId,
          }),
          { name: slug },
        ),
      );
    },
  };
}
