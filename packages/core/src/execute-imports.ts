/** Pi-facing Code Mode tool. Runtime facet stays `execute`. Not computer `shell`. */
export const OFFICE_CODE_TOOL_NAME = "code";

/** Bare npm specifiers the execute sandbox may bundle. Not paths or builtins. */
const PACKAGE_NAME =
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const STATIC_FROM =
  /(?:^|\n)([ \t]*import(?:\s+type)?\s+[\s\S]*?\sfrom\s+["']([^"']+)["'][ \t]*;?[ \t]*)/g;
const STATIC_SIDE =
  /(?:^|\n)([ \t]*import\s+["']([^"']+)["'][ \t]*;?[ \t]*)/g;
const DYNAMIC = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

export function isNpmPackageName(spec: string): boolean {
  return PACKAGE_NAME.test(spec);
}

export type ExecuteNpmImports = {
  /** Code with static npm imports stripped (safe to inline in an async function). */
  body: string;
  /** Those import statements, to prepend at module scope before bundling. */
  importSource: string;
  dependencies: Record<string, string>;
};

function remember(
  dependencies: Record<string, string>,
  spec: string,
): boolean {
  if (!isNpmPackageName(spec)) return false;
  dependencies[spec] = "latest";
  return true;
}

/**
 * Pull npm imports out of model-written execute code so the host can bundle
 * them. Relative, builtin, and `cloudflare:` specifiers stay in the body.
 */
export function splitExecuteNpmImports(code: string): ExecuteNpmImports {
  const dependencies: Record<string, string> = {};
  const hoisted: string[] = [];
  let body = code;

  body = body.replace(STATIC_FROM, (all, stmt: string, spec: string) => {
    if (!remember(dependencies, spec)) return all;
    hoisted.push(stmt.trim());
    return all.startsWith("\n") ? "\n" : "";
  });

  body = body.replace(STATIC_SIDE, (all, stmt: string, spec: string) => {
    if (!remember(dependencies, spec)) return all;
    hoisted.push(stmt.trim());
    return all.startsWith("\n") ? "\n" : "";
  });

  for (const match of body.matchAll(DYNAMIC)) {
    remember(dependencies, match[1] ?? "");
  }

  return {
    body,
    importSource: hoisted.join("\n"),
    dependencies,
  };
}

/**
 * Code Mode takes `code` (sandbox JS). Models often send `command` because
 * computer `shell` uses that name — read either so we don't crash on
 * `code.length` when `code` is missing.
 */
export function executeCodeFromInput(input: unknown): string {
  if (typeof input === "string") return input.trim();
  if (!input || typeof input !== "object" || Array.isArray(input)) return "";
  const row = input as Record<string, unknown>;
  for (const key of ["code", "command"] as const) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
