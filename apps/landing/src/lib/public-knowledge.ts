import {
  PublicKnowledgeSchema,
  type PublicKnowledge,
} from "@groxbot/contracts";
import { LANDING_ORIGINS } from "./discovery";

export function publicKnowledgeUrl(
  shareId: string,
  path?: string,
  kind: "json" | "raw" = "json",
): string {
  const suffix = kind === "raw" ? "/raw" : "";
  const url = new URL(
    `/public/knowledge/${encodeURIComponent(shareId)}${suffix}`,
    `${LANDING_ORIGINS.api}/`,
  );
  if (path) url.searchParams.set("path", path);
  return url.href;
}

export async function loadPublicKnowledge(
  shareId: string,
  path?: string,
): Promise<PublicKnowledge | null> {
  const id = shareId.trim();
  if (!id) return null;
  try {
    const response = await fetch(publicKnowledgeUrl(id, path), {
      headers: { accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const parsed = PublicKnowledgeSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
