import {
  CLOUDFLARE_PROVIDER,
  type ModelProvider,
  type SaveModelKeyInput,
} from "@groxbot/contracts";

export function providerSecretDraftsDirty(
  drafts: Partial<Record<ModelProvider, string>>,
): boolean {
  return Object.entries(drafts).some(
    ([provider, value]) =>
      provider !== CLOUDFLARE_PROVIDER && Boolean(value?.trim()),
  );
}

export function cloudflareSettingsDirty(input: {
  draftToken?: string;
  accountId: string;
  gatewayId: string;
  savedAccountId?: string | null;
  savedGatewayId?: string | null;
}): boolean {
  if (input.draftToken?.trim()) return true;
  if (input.accountId.trim() !== (input.savedAccountId ?? "").trim()) {
    return true;
  }
  return input.gatewayId.trim() !== (input.savedGatewayId ?? "").trim();
}

/** New Cloudflare BYOK needs both fields. A configured row can patch either. */
export function canSaveCloudflareSettings(input: {
  draftToken?: string;
  accountId: string;
  configured: boolean;
}): boolean {
  const token = Boolean(input.draftToken?.trim());
  const account = Boolean(input.accountId.trim());
  if (input.configured) return token || account;
  return token && account;
}

export function modelKeyDraftsReady(input: {
  drafts: Partial<Record<ModelProvider, string>>;
  accountId: string;
  gatewayId: string;
  savedAccountId?: string | null;
  savedGatewayId?: string | null;
  cloudflareConfigured: boolean;
}): boolean {
  if (providerSecretDraftsDirty(input.drafts)) return true;
  return (
    cloudflareSettingsDirty(input) &&
    canSaveCloudflareSettings({
      draftToken: input.drafts[CLOUDFLARE_PROVIDER],
      accountId: input.accountId,
      configured: input.cloudflareConfigured,
    })
  );
}

export function modelKeySavePayload(input: {
  drafts: Partial<Record<ModelProvider, string>>;
  accountId: string;
  gatewayId: string;
  savedAccountId?: string | null;
  savedGatewayId?: string | null;
  cloudflareConfigured: boolean;
}): SaveModelKeyInput[] {
  const keys: SaveModelKeyInput[] = [];
  for (const [provider, secret] of Object.entries(input.drafts) as Array<
    [ModelProvider, string | undefined]
  >) {
    if (provider === CLOUDFLARE_PROVIDER) continue;
    const trimmed = secret?.trim();
    if (trimmed) keys.push({ provider, secret: trimmed });
  }
  if (
    cloudflareSettingsDirty(input) &&
    canSaveCloudflareSettings({
      draftToken: input.drafts[CLOUDFLARE_PROVIDER],
      accountId: input.accountId,
      configured: input.cloudflareConfigured,
    })
  ) {
    keys.push({
      provider: CLOUDFLARE_PROVIDER,
      secret: input.drafts[CLOUDFLARE_PROVIDER]?.trim() || undefined,
      accountId: input.accountId.trim() || undefined,
      gatewayId: input.gatewayId.trim() || undefined,
    });
  }
  return keys;
}
