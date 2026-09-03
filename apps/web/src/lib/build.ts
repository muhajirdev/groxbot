/** Git SHA baked in at `vite build`. Local `vite` uses `git rev-parse`. */
export const BUILD_REVISION = (
  import.meta.env.VITE_GIT_SHA?.trim() || "dev"
).trim();

export function shortRevision(raw: string): string {
  const value = raw.trim() || "dev";
  if (value === "dev") return "dev";
  return value.length > 7 ? value.slice(0, 7) : value;
}
