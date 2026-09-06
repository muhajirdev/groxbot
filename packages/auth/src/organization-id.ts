/** Stash a client-generated org id in Better Auth metadata; the create hook promotes it. */
export const ORGANIZATION_CLIENT_ID_KEY = "groxbotClientId";

export function organizationCreateFromClientId(organization: {
  name?: string;
  slug?: string;
  logo?: string | null;
  metadata?: Record<string, unknown> | null;
}): { data: Record<string, unknown> } | undefined {
  const metadata = { ...(organization.metadata ?? {}) };
  const raw = metadata[ORGANIZATION_CLIENT_ID_KEY];
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return undefined;
  delete metadata[ORGANIZATION_CLIENT_ID_KEY];
  return {
    data: {
      ...organization,
      id,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  };
}
