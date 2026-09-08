import type {
  ModelKeyStatus,
  ModelProvider,
  ModelSettings,
  OpenAiCodexAuth,
  SaveModelSettingsInput,
} from "@groxbot/contracts";
import {
  ANTHROPIC_PROVIDER,
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  DEFAULT_AI_GATEWAY_ID,
  GROXBOT_AUTO_MODEL,
  GROXBOT_FREE_MODEL,
  asHostedGroxbotModelId,
  gatewayModelId,
  groxHostedGateway,
  HOSTED_AI_ENV,
  HOSTED_AI_FLAG,
  HOSTED_STARTER_MODEL,
  hostedAiEnabled,
  hostedCloudflareGateway,
  hostedStarterModel,
  MODEL_CATALOG,
  missingProviderMessage,
  modelIsRunnable,
  OPENAI_CODEX_AUTH_ENV,
  OPENAI_CODEX_PROVIDER,
  OPENAI_PROVIDER,
  OPENROUTER_PROVIDER,
  openAiCodexHint,
  PRODUCT_RUNTIME,
  PROVIDER_META,
  PROVIDER_ORDER,
  packOpenAiCodexAuth,
  parseOpenAiCodexAuth,
  providerForModel,
  resolveStoredModelId,
  SUGGESTED_STARTER_MODEL,
  validateCloudflareAccountId,
  validateModelId,
  validateProviderSecret,
} from "@groxbot/contracts";
import type { Database } from "@groxbot/db";
import { secrets, userModelCredentials, workspaceModels } from "@groxbot/db";
import { eq } from "drizzle-orm";
import { ensureWorkspaceBilling, utcMonthStartIso } from "./billing.js";
import { newId } from "./ids.js";
import {
  fetchOpenRouterCatalog,
  mergeOpenRouterIntoCatalog,
} from "./openrouter-models.js";
import { decryptSecret, encryptSecret, secretHint } from "./secret-box.js";

const PROVIDERS: ModelProvider[] = [...PROVIDER_ORDER];

const DEV_FALLBACK = "development-only-change-me-please-32ch";

export const PROVIDER_ENV: Record<
  Exclude<
    ModelProvider,
    typeof CLOUDFLARE_PROVIDER | typeof OPENAI_CODEX_PROVIDER
  >,
  string
> = {
  [ANTHROPIC_PROVIDER]: "ANTHROPIC_API_KEY",
  [OPENAI_PROVIDER]: "OPENAI_API_KEY",
  [OPENROUTER_PROVIDER]: "OPENROUTER_API_KEY",
};

/** Cleared from process env on each run so only Settings → Models keys apply. */
const PROCESS_MODEL_ENV = [
  "GROXBOT_MODEL",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  OPENAI_CODEX_AUTH_ENV,
  "OPENROUTER_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AI_GATEWAY_TOKEN",
  "CLOUDFLARE_AUTH_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_AI_GATEWAY_ID",
  "CLOUDFLARE_GATEWAY_ID",
  "AI_GATEWAY_PROVIDER",
  "AI_GATEWAY_MODEL",
  HOSTED_AI_ENV,
] as const;

export interface ModelOverlay {
  env: NodeJS.ProcessEnv;
  model: string;
  configured: boolean;
  /** True when this turn uses Groxbot’s included Cloudflare AI Gateway. */
  hosted: boolean;
}

export class ModelSettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelSettingsError";
  }
}

export function encryptionSecret(
  source: NodeJS.ProcessEnv,
  production = source.NODE_ENV === "production",
): string {
  const explicit = source.ENCRYPTION_KEY?.trim();
  if (explicit) {
    if (production && explicit.length < 32) {
      throw new Error(
        "ENCRYPTION_KEY must be at least 32 characters in production",
      );
    }
    return explicit;
  }
  const auth = source.BETTER_AUTH_SECRET?.trim();
  if (auth && auth !== DEV_FALLBACK) {
    if (production && auth.length < 32) {
      throw new Error(
        "BETTER_AUTH_SECRET must be at least 32 characters in production",
      );
    }
    return auth;
  }
  if (production) {
    throw new Error(
      "ENCRYPTION_KEY or BETTER_AUTH_SECRET is required in production",
    );
  }
  return DEV_FALLBACK;
}

function envKeyConfigured(
  provider: ModelProvider,
  env: NodeJS.ProcessEnv,
): boolean {
  if (provider === CLOUDFLARE_PROVIDER) {
    if (hostedAiEnabled(env)) return true;
    const token =
      env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim() ||
      env.CLOUDFLARE_API_TOKEN?.trim() ||
      env.CLOUDFLARE_API_KEY?.trim() ||
      env.CLOUDFLARE_AUTH_TOKEN?.trim();
    return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && token);
  }
  if (provider === OPENAI_CODEX_PROVIDER) {
    return parseOpenAiCodexAuth(env[OPENAI_CODEX_AUTH_ENV] ?? "").ok;
  }
  return Boolean(env[PROVIDER_ENV[provider]]?.trim());
}

function stripProcessModelEnv(env: NodeJS.ProcessEnv): void {
  for (const key of PROCESS_MODEL_ENV) {
    delete env[key];
  }
  delete env.CLOUDFLARE_ACCOUNT_ID;
}

function parseCloudflareSecret(raw: string): {
  accountId?: string;
  apiToken?: string;
  gatewayId?: string;
} {
  try {
    const parsed = JSON.parse(raw) as {
      accountId?: string;
      apiToken?: string;
      gatewayId?: string;
    };
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // stored as a bare token
  }
  return { apiToken: raw };
}

export function applyHostedCloudflareEnv(
  env: NodeJS.ProcessEnv,
  hosted: ReturnType<typeof hostedCloudflareGateway>,
): boolean {
  if (!hosted) return false;
  if (envKeyConfigured(CLOUDFLARE_PROVIDER, env)) return false;
  env.CLOUDFLARE_AI_GATEWAY_ID = hosted.gatewayId;
  env.CLOUDFLARE_GATEWAY_ID = hosted.gatewayId;
  if (hosted.kind === "binding") {
    env[HOSTED_AI_ENV] = HOSTED_AI_FLAG;
    return true;
  }
  env.CLOUDFLARE_ACCOUNT_ID = hosted.accountId;
  env.CLOUDFLARE_API_TOKEN = hosted.apiToken;
  env.CLOUDFLARE_API_KEY = hosted.apiToken;
  env.CLOUDFLARE_AI_GATEWAY_TOKEN = hosted.apiToken;
  return true;
}

export function fallbackRunnableModel(
  model: string,
  providers: readonly ModelProvider[],
  hosted = false,
  hostedStarter = HOSTED_STARTER_MODEL,
): string {
  const current = gatewayModelId(model);
  const runnableOpts = { hostedGateway: hosted };
  if (current && modelIsRunnable(current, providers, runnableOpts)) {
    return hosted && current.startsWith("openrouter/")
      ? asHostedGroxbotModelId(current)
      : current;
  }
  if (hosted && modelIsRunnable(hostedStarter, providers, runnableOpts)) {
    return gatewayModelId(hostedStarter);
  }
  const fromCatalog = MODEL_CATALOG.find((item) =>
    modelIsRunnable(item.id, providers, runnableOpts),
  )?.id;
  const fallback = gatewayModelId(fromCatalog || SUGGESTED_STARTER_MODEL);
  return hosted && fallback.startsWith("openrouter/")
    ? asHostedGroxbotModelId(fallback)
    : fallback;
}

function configuredProviders(keys: ModelKeyStatus[]): ModelProvider[] {
  return keys.filter((item) => item.configured).map((item) => item.provider);
}

export async function loadModelSettings(
  db: Database,
  actor: { userId: string; workspaceId: string },
  env: NodeJS.ProcessEnv,
  secret: string,
): Promise<ModelSettings> {
  const runtime = PRODUCT_RUNTIME;
  const creds = await db
    .select()
    .from(userModelCredentials)
    .where(eq(userModelCredentials.workspaceId, actor.workspaceId));
  const secretRows = await db
    .select()
    .from(secrets)
    .where(eq(secrets.workspaceId, actor.workspaceId));
  const [workspace] = await db
    .select()
    .from(workspaceModels)
    .where(eq(workspaceModels.workspaceId, actor.workspaceId))
    .limit(1);
  const secretById = new Map(secretRows.map((row) => [row.id, row]));
  const byProvider = new Map(creds.map((row) => [row.provider, row]));

  const hosted = hostedCloudflareGateway(env);
  const keys: ModelKeyStatus[] = PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    if (!row) {
      return {
        provider,
        configured: false,
        source: "none" as const,
        hint: null,
        accountId: null,
        gatewayId: null,
      };
    }
    const packed = secretById.get(row.secretId)?.ciphertext;
    let hint: string | null = "••••";
    let accountId: string | null = null;
    let gatewayId: string | null = null;
    if (packed) {
      try {
        const plain = decryptSecret(packed, secret);
        if (provider === CLOUDFLARE_PROVIDER) {
          const parsed = parseCloudflareSecret(plain);
          hint = secretHint(parsed.apiToken ?? plain);
          accountId = parsed.accountId?.trim() || null;
          gatewayId = parsed.gatewayId?.trim() || DEFAULT_AI_GATEWAY_ID;
        } else if (provider === OPENAI_CODEX_PROVIDER) {
          const parsed = parseOpenAiCodexAuth(plain);
          hint = parsed.ok ? openAiCodexHint(parsed.auth) : "••••";
        } else {
          hint = secretHint(plain);
        }
      } catch {
        hint = "••••";
      }
    }
    return {
      provider,
      configured: true,
      source: "workspace" as const,
      hint,
      accountId,
      gatewayId,
    };
  });

  const choice = secretRows.find((row) => row.kind === "model:choice");
  let legacyChoice = "";
  if (choice) {
    try {
      legacyChoice = decryptSecret(choice.ciphertext, secret).trim();
    } catch {
      legacyChoice = "";
    }
  }
  const configured = configuredProviders(keys);
  const available = [
    ...configured,
    ...(hosted && !configured.includes(CLOUDFLARE_PROVIDER)
      ? ([CLOUDFLARE_PROVIDER] as const)
      : []),
  ];
  const storedRaw =
    workspace?.defaultModel.trim() ||
    legacyChoice ||
    creds.find((row) => row.isDefault)?.defaultModel?.trim() ||
    "";
  const stored =
    groxHostedGateway(env) && storedRaw.startsWith("openrouter/")
      ? asHostedGroxbotModelId(storedRaw)
      : storedRaw;
  const defaultModelId = fallbackRunnableModel(
    stored || (hosted ? hostedStarterModel(env) : SUGGESTED_STARTER_MODEL),
    available,
    Boolean(hosted),
    hostedStarterModel(env),
  );
  const listedStatic = MODEL_CATALOG.some((item) => item.id === defaultModelId);
  const groxGateway = Boolean(groxHostedGateway(env));
  const runnableOpts = { hostedGateway: groxGateway };
  const staticCatalog = MODEL_CATALOG.filter((item) => {
    if (groxGateway) return true;
    return item.id !== GROXBOT_AUTO_MODEL && item.id !== GROXBOT_FREE_MODEL;
  }).map((item) => {
    const viaGateway =
      groxGateway && item.provider === OPENROUTER_PROVIDER;
    return {
      id: viaGateway ? asHostedGroxbotModelId(item.id) : item.id,
      label: item.label,
      // Hosted grox-gateway: OpenRouter models sit under Groxbot, not a separate key.
      provider: viaGateway ? CLOUDFLARE_PROVIDER : item.provider,
      available: viaGateway
        ? true
        : modelIsRunnable(item.id, available, runnableOpts),
    };
  });
  const openRouterLive = await fetchOpenRouterCatalog({
    available: groxGateway || available.includes(OPENROUTER_PROVIDER),
  });
  const openRouterRows = groxGateway
    ? openRouterLive.map((row) => ({
        ...row,
        id: asHostedGroxbotModelId(row.id),
        provider: CLOUDFLARE_PROVIDER,
        available: true,
      }))
    : openRouterLive;
  const catalog = mergeOpenRouterIntoCatalog(staticCatalog, openRouterRows);
  const listed =
    listedStatic || catalog.some((item) => item.id === defaultModelId);
  const warning =
    available.length > 0 &&
    !modelIsRunnable(defaultModelId, available, runnableOpts)
      ? missingProviderMessage(defaultModelId)
      : null;
  const billing = await ensureWorkspaceBilling(db, actor.workspaceId);

  return {
    keys,
    defaultModel: listed ? defaultModelId : CUSTOM_MODEL_SENTINEL,
    customModel: listed ? "" : defaultModelId,
    defaultModelId,
    fromEnv: Boolean(hosted),
    hostedGateway: Boolean(hosted),
    runtime,
    catalog,
    warning,
    usage: {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      periodStart: utcMonthStartIso(),
      monthlyTokenLimit: billing.monthlyTokenLimit,
    },
  };
}

export async function saveModelSettings(
  db: Database,
  actor: { userId: string; workspaceId: string },
  input: SaveModelSettingsInput,
  secret: string,
  env: NodeJS.ProcessEnv = {},
): Promise<ModelSettings> {
  const defaultModel = resolveStoredModelId(input);
  if (!defaultModel) {
    throw new ModelSettingsError("Pick a default model.");
  }
  if (
    input.defaultModel === CUSTOM_MODEL_SENTINEL &&
    !input.customModel?.trim()
  ) {
    throw new ModelSettingsError("Enter a custom model id.");
  }
  const modelProblem = validateModelId(defaultModel);
  if (modelProblem) throw new ModelSettingsError(modelProblem);

  for (const item of input.keys) {
    if (item.clear) continue;
    const incoming = item.secret?.trim();
    if (incoming) {
      const problem = validateProviderSecret(item.provider, incoming);
      if (problem) throw new ModelSettingsError(problem);
    }
    if (item.provider === CLOUDFLARE_PROVIDER && item.accountId?.trim()) {
      const problem = validateCloudflareAccountId(item.accountId);
      if (problem) throw new ModelSettingsError(problem);
    }
  }

  const now = new Date();
  const existingCreds = await db
    .select()
    .from(userModelCredentials)
    .where(eq(userModelCredentials.workspaceId, actor.workspaceId));
  const existingSecrets = await db
    .select()
    .from(secrets)
    .where(eq(secrets.workspaceId, actor.workspaceId));
  const credByProvider = new Map(
    existingCreds.map((row) => [row.provider, row]),
  );
  const secretByKind = new Map(existingSecrets.map((row) => [row.kind, row]));

  for (const item of input.keys) {
    const kind = `model:${item.provider}`;
    if (item.clear) {
      const cred = credByProvider.get(item.provider);
      if (cred) {
        await db
          .delete(userModelCredentials)
          .where(eq(userModelCredentials.id, cred.id));
      }
      const row = secretByKind.get(kind);
      if (row) await db.delete(secrets).where(eq(secrets.id, row.id));
      continue;
    }
    const incoming = item.secret?.trim();
    if (item.provider === CLOUDFLARE_PROVIDER) {
      const token = incoming;
      const accountId = item.accountId?.trim();
      if (!token && !accountId && !item.gatewayId?.trim()) continue;
      const previous = secretByKind.get(kind);
      let parsed: {
        accountId?: string;
        apiToken?: string;
        gatewayId?: string;
      } = {};
      if (previous) {
        try {
          parsed = parseCloudflareSecret(
            decryptSecret(previous.ciphertext, secret),
          );
        } catch {
          parsed = {};
        }
      }
      const next = {
        accountId: accountId || parsed.accountId || "",
        apiToken: token || parsed.apiToken || "",
        gatewayId:
          item.gatewayId?.trim() || parsed.gatewayId || DEFAULT_AI_GATEWAY_ID,
      };
      if (!next.accountId || !next.apiToken) {
        if (token || accountId) {
          throw new ModelSettingsError(
            "Cloudflare needs both an account id and an API token.",
          );
        }
        continue;
      }
      await upsertSecret(db, actor, kind, JSON.stringify(next), secret, now);
      await upsertCredential(
        db,
        actor,
        item.provider,
        kind,
        defaultModel,
        now,
        credByProvider.get(item.provider),
      );
      continue;
    }
    if (!incoming) continue;
    let stored = incoming;
    if (item.provider === OPENAI_CODEX_PROVIDER) {
      const parsed = parseOpenAiCodexAuth(incoming);
      if (!parsed.ok) throw new ModelSettingsError(parsed.error);
      stored = packOpenAiCodexAuth(parsed.auth);
    }
    await upsertSecret(db, actor, kind, stored, secret, now);
    await upsertCredential(
      db,
      actor,
      item.provider,
      kind,
      defaultModel,
      now,
      credByProvider.get(item.provider),
    );
  }

  const [existingWorkspace] = await db
    .select()
    .from(workspaceModels)
    .where(eq(workspaceModels.workspaceId, actor.workspaceId))
    .limit(1);
  if (existingWorkspace) {
    await db
      .update(workspaceModels)
      .set({
        defaultModel,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .where(eq(workspaceModels.workspaceId, actor.workspaceId));
  } else {
    await db.insert(workspaceModels).values({
      workspaceId: actor.workspaceId,
      defaultModel,
      updatedBy: actor.userId,
      updatedAt: now,
    });
  }

  const creds = await db
    .select()
    .from(userModelCredentials)
    .where(eq(userModelCredentials.workspaceId, actor.workspaceId));
  for (const row of creds) {
    await db
      .update(userModelCredentials)
      .set({
        defaultModel,
        isDefault: providerForModel(defaultModel) === row.provider,
        updatedAt: now,
      })
      .where(eq(userModelCredentials.id, row.id));
  }

  const staleChoice = secretByKind.get("model:choice");
  if (staleChoice) {
    await db.delete(secrets).where(eq(secrets.id, staleChoice.id));
  }

  return loadModelSettings(db, actor, env, secret);
}

type DbLike = {
  select: Database["select"];
  update: Database["update"];
  insert: Database["insert"];
};

async function upsertSecret(
  db: DbLike,
  actor: { userId: string; workspaceId: string },
  kind: string,
  plain: string,
  secret: string,
  now: Date,
): Promise<string> {
  const rows = await db
    .select()
    .from(secrets)
    .where(eq(secrets.workspaceId, actor.workspaceId));
  const found = rows.find((row) => row.kind === kind);
  const ciphertext = encryptSecret(plain, secret);
  if (found) {
    await db
      .update(secrets)
      .set({ ciphertext, userId: actor.userId })
      .where(eq(secrets.id, found.id));
    return found.id;
  }
  const id = newId();
  await db.insert(secrets).values({
    id,
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    kind,
    ciphertext,
    createdAt: now,
  });
  return id;
}

async function upsertCredential(
  db: DbLike,
  actor: { userId: string; workspaceId: string },
  provider: ModelProvider,
  kind: string,
  defaultModel: string,
  now: Date,
  existing: typeof userModelCredentials.$inferSelect | undefined,
): Promise<void> {
  const secretRows = await db
    .select()
    .from(secrets)
    .where(eq(secrets.workspaceId, actor.workspaceId));
  const secretId = secretRows.find((row) => row.kind === kind)?.id;
  if (!secretId) return;
  const label = PROVIDER_META[provider].label;
  if (existing) {
    await db
      .update(userModelCredentials)
      .set({
        secretId,
        label,
        defaultModel,
        userId: actor.userId,
        updatedAt: now,
      })
      .where(eq(userModelCredentials.id, existing.id));
    return;
  }
  await db.insert(userModelCredentials).values({
    id: newId(),
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    provider,
    label,
    secretId,
    isDefault: false,
    defaultModel,
    createdAt: now,
    updatedAt: now,
  });
}

export async function resolveRunModel(
  db: Database,
  bot: { userId: string; workspaceId: string; model?: string | null },
  baseEnv: NodeJS.ProcessEnv,
  secret: string,
): Promise<ModelOverlay> {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  const hosted = hostedCloudflareGateway(baseEnv);
  stripProcessModelEnv(env);
  const settings = await loadStoredEnv(db, bot.workspaceId, secret);
  Object.assign(env, settings.env);
  const usedHosted = applyHostedCloudflareEnv(env, hosted);
  const providers: ModelProvider[] = PROVIDERS.filter((provider) =>
    envKeyConfigured(provider, env),
  );
  const model = fallbackRunnableModel(
    bot.model?.trim() || settings.defaultModel,
    providers,
    usedHosted,
    hostedStarterModel(baseEnv),
  );
  const runModel =
    groxHostedGateway(baseEnv) && model.startsWith("openrouter/")
      ? asHostedGroxbotModelId(model)
      : model;
  if (runModel) env.GROXBOT_MODEL = runModel;
  const configured = modelIsRunnable(runModel, providers, {
    hostedGateway: Boolean(groxHostedGateway(baseEnv)),
  });
  return {
    env,
    model: runModel,
    configured,
    hosted: usedHosted && providerForModel(runModel) === CLOUDFLARE_PROVIDER,
  };
}

async function loadStoredEnv(
  db: Database,
  workspaceId: string,
  secret: string,
): Promise<{ env: NodeJS.ProcessEnv; defaultModel: string }> {
  const creds = await db
    .select()
    .from(userModelCredentials)
    .where(eq(userModelCredentials.workspaceId, workspaceId));
  const env: NodeJS.ProcessEnv = {};
  const secretRows = await db
    .select()
    .from(secrets)
    .where(eq(secrets.workspaceId, workspaceId));
  const [workspace] = await db
    .select()
    .from(workspaceModels)
    .where(eq(workspaceModels.workspaceId, workspaceId))
    .limit(1);
  let defaultModel = workspace?.defaultModel.trim() || "";
  if (!defaultModel) {
    const stored = secretRows.find((row) => row.kind === "model:choice");
    if (stored) {
      try {
        defaultModel = decryptSecret(stored.ciphertext, secret).trim();
      } catch {
        defaultModel = "";
      }
    }
  }
  const byId = new Map(secretRows.map((row) => [row.id, row]));
  for (const row of creds) {
    const packed = byId.get(row.secretId);
    if (!packed) continue;
    let plain: string;
    try {
      plain = decryptSecret(packed.ciphertext, secret);
    } catch {
      continue;
    }
    const provider = row.provider as ModelProvider;
    if (provider === CLOUDFLARE_PROVIDER) {
      const parsed = parseCloudflareSecret(plain);
      if (parsed.accountId) env.CLOUDFLARE_ACCOUNT_ID = parsed.accountId;
      if (parsed.apiToken) {
        // Gateway REST also accepts CLOUDFLARE_API_KEY.
        env.CLOUDFLARE_API_KEY = parsed.apiToken;
        env.CLOUDFLARE_API_TOKEN = parsed.apiToken;
      }
      const gatewayId = parsed.gatewayId?.trim() || DEFAULT_AI_GATEWAY_ID;
      env.CLOUDFLARE_GATEWAY_ID = gatewayId;
      env.CLOUDFLARE_AI_GATEWAY_ID = gatewayId;
    } else if (provider === OPENAI_CODEX_PROVIDER) {
      const parsed = parseOpenAiCodexAuth(plain);
      if (parsed.ok) {
        env[OPENAI_CODEX_AUTH_ENV] = packOpenAiCodexAuth(parsed.auth);
      }
    } else if (provider in PROVIDER_ENV) {
      env[
        PROVIDER_ENV[
          provider as Exclude<
            ModelProvider,
            typeof CLOUDFLARE_PROVIDER | typeof OPENAI_CODEX_PROVIDER
          >
        ]
      ] = plain;
    }
    if (!defaultModel && row.defaultModel) defaultModel = row.defaultModel;
  }
  return { env, defaultModel };
}

export async function persistOpenAiCodexAuth(
  db: Database,
  actor: { userId: string; workspaceId: string },
  auth: OpenAiCodexAuth,
  secret: string,
): Promise<void> {
  if (!actor.userId.trim() || !actor.workspaceId.trim()) return;
  await upsertSecret(
    db,
    actor,
    `model:${OPENAI_CODEX_PROVIDER}`,
    packOpenAiCodexAuth(auth),
    secret,
    new Date(),
  );
}

export function userHasModelCredentials(count: number): boolean {
  return count > 0;
}

export function missingModelMessage(model: string): string {
  return `${missingProviderMessage(model)} Open Settings → Models.`;
}
