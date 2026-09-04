/**
 * Code Mode's proxy calls `tool(args[0])`. Models often pass a lone string
 * (`knowledge.read("skills/…/SKILL.md")`) instead of `{ path }`.
 * Map that onto `positionalKey`. Objects pass through. Do not use a
 * positional key on methods that need two strings (write, create).
 */
export function connectorRecord(
  args: unknown,
  positionalKey?: string,
): Record<string, unknown> | undefined {
  if (typeof args === "string") {
    if (!positionalKey) return undefined;
    const trimmed = args.trim();
    return trimmed ? { [positionalKey]: trimmed } : undefined;
  }
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  return undefined;
}

export function connectorString(
  args: unknown,
  key: string,
  positional = false,
): string | undefined {
  const row = connectorRecord(args, positional ? key : undefined);
  if (!row) return undefined;
  const value = row[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
