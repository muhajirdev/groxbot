import type {
  ModelKeyStatus,
  ModelProvider,
  ModelSettings,
  SaveModelSettingsInput,
} from "@groxbot/contracts";
import {
  catalogForRuntime,
  flueModelId,
  HOSTED_STARTER_MODEL,
  hostedCloudflareGateway,
  isOfflineRuntime,
  missingProviderMessage,
  modelIsRunnable,
  PROVIDER_META,
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
import { newId } from "./ids.js";
import { decryptSecret, encryptSecret, secretHint } from "./secret-box.js";
import { workspaceModelUsage } from "./usage.js";

const PROVIDERS: ModelProvider[] = [
  "openrouter",
  "anthropic",
  "openai",
  "cloudflare",
];

const DEV_FALLBACK = "development-only-change-me-please-32ch";

export const PROVIDER_ENV: Record<
  Exclude<ModelProvider, "cloudflare">,
  string
> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

/** Cleared from process env on each run so only Settings → Models keys apply. */
const PROCESS_MODEL_ENV = [
  "GROXBOT_MODEL",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_AI_GATEWAY_TOKEN",
  "CLOUDFLARE_AUTH_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_AI_GATEWAY_ID",
  "CLOUDFLARE_GATEWAY_ID",
  "AI_GATEWAY_PROVIDER",
  "AI_GATEWAY_MODEL",
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
  if (provider === "cloudflare") {
    const token =
      env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim() ||
      env.CLOUDFLARE_API_TOKEN?.trim() ||
      env.CLOUDFLARE_API_KEY?.trim() ||
      env.CLOUDFLARE_AUTH_TOKEN?.trim();
    return Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && token);
  }
  return Boolean(env[PROVIDER_ENV[provider]]?.trim());
}

function stripProcessModelEnv(env: NodeJS.ProcessEnv): void {
  for (const key of PROCESS_MODEL_ENV) {
    delete env[key];
  }
  // Account id is shared with email on the host; AI uses the workspace pack only.
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
  if (envKeyConfigured("cloudflare", env)) return false;
  env.CLOUDFLARE_ACCOUNT_ID = hosted.accountId;
  env.CLOUDFLARE_API_TOKEN = hosted.apiToken;
  env.CLOUDFLARE_API_KEY = hosted.apiToken;
  env.CLOUDFLARE_AI_GATEWAY_TOKEN = hosted.apiToken;
  env.CLOUDFLARE_AI_GATEWAY_ID = hosted.gatewayId;
  env.CLOUDFLARE_GATEWAY_ID = hosted.gatewayId;
  return true;
}

export function fallbackRunnableModel(
  model: string,
  providers: readonly ModelProvider[],
  runtime?: string,
  hosted = false,
): string {
  const current = flueModelId(model);
  if (current && modelIsRunnable(current, providers)) return current;
  const fromCatalog = catalogForRuntime(runtime).find((item) =>
    modelIsRunnable(item.id, providers),
  )?.id;
  return flueModelId(
    fromCatalog || (hosted ? HOSTED_STARTER_MODEL : SUGGESTED_STARTER_MODEL),
  );
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
  const runtime = env.AGENT_RUNTIME?.trim() || "flue";
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
        if (provider === "cloudflare") {
          const parsed = parseCloudflareSecret(plain);
          hint = secretHint(parsed.apiToken ?? plain);
          accountId = parsed.accountId?.trim() || null;
          gatewayId = parsed.gatewayId?.trim() || "default";
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
    ...(hosted && !configured.includes("cloudflare")
      ? (["cloudflare"] as const)
      : []),
  ];
  const stored =
    workspace?.defaultModel.trim() ||
    legacyChoice ||
    creds.find((row) => row.isDefault)?.defaultModel?.trim() ||
    "";
  const fallback =
    catalogForRuntime(runtime).find((item) =>
      modelIsRunnable(item.id, available),
    )?.id ?? (hosted ? HOSTED_STARTER_MODEL : SUGGESTED_STARTER_MODEL);
  const defaultModelId = flueModelId(stored || fallback);
  const listed = catalogForRuntime(runtime).some(
    (item) => item.id === defaultModelId,
  );
  const catalog = catalogForRuntime(runtime).map((item) => ({
    id: item.id,
    label: item.label,
    provider: item.provider,
    available: modelIsRunnable(item.id, available),
  }));
  const warning =
    available.length > 0 && !modelIsRunnable(defaultModelId, available)
      ? missingProviderMessage(defaultModelId)
      : null;
  const usage = await workspaceModelUsage(db, actor.workspaceId);

  return {
    keys,
    defaultModel: listed ? defaultModelId : "custom",
    customModel: listed ? "" : defaultModelId,
    defaultModelId,
    fromEnv: Boolean(hosted),
    hostedGateway: Boolean(hosted),
    runtime,
    catalog,
    warning,
    usage,
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
  if (input.defaultModel === "custom" && !input.customModel?.trim()) {
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
    if (item.provider === "cloudflare" && item.accountId?.trim()) {
      const problem = validateCloudflareAccountId(item.accountId);
      if (problem) throw new ModelSettingsError(problem);
    }
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const existingCreds = await tx
      .select()
      .from(userModelCredentials)
      .where(eq(userModelCredentials.workspaceId, actor.workspaceId));
    const existingSecrets = await tx
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
          await tx
            .delete(userModelCredentials)
            .where(eq(userModelCredentials.id, cred.id));
        }
        const row = secretByKind.get(kind);
        if (row) await tx.delete(secrets).where(eq(secrets.id, row.id));
        continue;
      }
      const incoming = item.secret?.trim();
      if (item.provider === "cloudflare") {
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
          gatewayId: item.gatewayId?.trim() || parsed.gatewayId || "default",
        };
        if (!next.accountId || !next.apiToken) {
          if (token || accountId) {
            throw new ModelSettingsError(
              "Cloudflare needs both an account id and an API token.",
            );
          }
          continue;
        }
        await upsertSecret(tx, actor, kind, JSON.stringify(next), secret, now);
        await upsertCredential(
          tx,
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
      await upsertSecret(tx, actor, kind, incoming, secret, now);
      await upsertCredential(
        tx,
        actor,
        item.provider,
        kind,
        defaultModel,
        now,
        credByProvider.get(item.provider),
      );
    }

    const [existingWorkspace] = await tx
      .select()
      .from(workspaceModels)
      .where(eq(workspaceModels.workspaceId, actor.workspaceId))
      .limit(1);
    if (existingWorkspace) {
      await tx
        .update(workspaceModels)
        .set({
          defaultModel,
          updatedBy: actor.userId,
          updatedAt: now,
        })
        .where(eq(workspaceModels.workspaceId, actor.workspaceId));
    } else {
      await tx.insert(workspaceModels).values({
        workspaceId: actor.workspaceId,
        defaultModel,
        updatedBy: actor.userId,
        updatedAt: now,
      });
    }

    const creds = await tx
      .select()
      .from(userModelCredentials)
      .where(eq(userModelCredentials.workspaceId, actor.workspaceId));
    for (const row of creds) {
      await tx
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
      await tx.delete(secrets).where(eq(secrets.id, staleChoice.id));
    }
  });

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
    env.AGENT_RUNTIME,
    usedHosted,
  );
  if (model) env.GROXBOT_MODEL = model;
  const configured =
    isOfflineRuntime(env.AGENT_RUNTIME) || modelIsRunnable(model, providers);
  return {
    env,
    model,
    configured,
    hosted: usedHosted && providerForModel(model) === "cloudflare",
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
    if (provider === "cloudflare") {
      const parsed = parseCloudflareSecret(plain);
      if (parsed.accountId) env.CLOUDFLARE_ACCOUNT_ID = parsed.accountId;
      if (parsed.apiToken) {
        // Pi's cloudflare-ai-gateway provider reads CLOUDFLARE_API_KEY.
        env.CLOUDFLARE_API_KEY = parsed.apiToken;
        env.CLOUDFLARE_API_TOKEN = parsed.apiToken;
      }
      const gatewayId = parsed.gatewayId?.trim() || "default";
      env.CLOUDFLARE_GATEWAY_ID = gatewayId;
      env.CLOUDFLARE_AI_GATEWAY_ID = gatewayId;
    } else if (provider in PROVIDER_ENV) {
      env[PROVIDER_ENV[provider as Exclude<ModelProvider, "cloudflare">]] =
        plain;
    }
    if (!defaultModel && row.defaultModel) defaultModel = row.defaultModel;
  }
  return { env, defaultModel };
}

export function userHasModelCredentials(count: number): boolean {
  return count > 0;
}

export function missingModelMessage(model: string): string {
  return `${missingProviderMessage(model)} Open Settings → Models.`;
}
