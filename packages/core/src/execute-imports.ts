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
