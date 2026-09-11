/** Cursor Cloud Agents HTTP — Worker fetch, not a Fly sidecar and not this computer. */

export const CURSOR_CLOUD_API = "https://api.cursor.com/v1";
export const CURSOR_KEY_REQUIRED_MESSAGE =
  "Paste a Cursor API key in Settings → Models. Cursor Cloud Agents is your key — Groxbot does not resell Cursor.";
export const CURSOR_POLL_CALLBACK = "pollCursorCloudAgent" as const;
export const CURSOR_POLL_MAX_ATTEMPTS = 40;
export const MAX_CURSOR_PROMPT = 8000;
export const MAX_CURSOR_REF = 200;

const GITHUB_REPO =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?\/?$/;

export class CursorCloudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorCloudError";
  }
}

export type CursorCloudLaunch = {
  agentId: string;
  runId: string;
  name: string;
  repo: string;
  url: string;
};

export type CursorCloudRunStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "CANCELLED"
  | "EXPIRED"
  | string;

export type CursorCloudRun = {
  id: string;
  agentId: string;
  status: CursorCloudRunStatus;
  result?: string;
  prUrl?: string;
  branch?: string;
};

export type CursorDispatchPayload = {
  agentId: string;
  runId: string;
  repo: string;
  prompt: string;
  attempt: number;
};

export type CursorFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

export function cursorApiKeyFromEnv(env: NodeJS.Dict<string> = {}): string {
  return env.CURSOR_API_KEY?.trim() ?? "";
}

export function requireCursorApiKey(env: NodeJS.Dict<string> = {}): string {
  const key = cursorApiKeyFromEnv(env);
  if (!key) throw new CursorCloudError(CURSOR_KEY_REQUIRED_MESSAGE);
  return key;
}

/** Accept owner/repo or a github.com URL. Cursor clones GitHub; Groxbot does not. */
export function normalizeGithubRepoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new CursorCloudError("Pass a GitHub repo (owner/repo).");
  const shorthand = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  const candidate = shorthand
    ? `https://github.com/${shorthand[1]}/${shorthand[2]}`
    : trimmed.startsWith("github.com/")
      ? `https://${trimmed}`
      : trimmed;
  const match = candidate.match(GITHUB_REPO);
  if (!match) {
    throw new CursorCloudError(
      "Use a GitHub repo URL or owner/repo. Cursor clones GitHub — Groxbot does not clone onto this computer.",
    );
  }
  const owner = match[1];
  const rawName = match[2];
  if (!owner || !rawName) {
    throw new CursorCloudError(
      "Use a GitHub repo URL or owner/repo. Cursor clones GitHub — Groxbot does not clone onto this computer.",
    );
  }
  const repoName = rawName.replace(/\.git$/i, "");
  return `https://github.com/${owner}/${repoName}`;
}

export function shortGithubRepo(repo: string): string {
  return repo.replace(/^https:\/\//, "");
}

export function parseCursorLaunchInput(input: {
  repo?: string;
  prompt?: string;
  ref?: string;
}): { repo: string; prompt: string; ref?: string } {
  const prompt = input.prompt?.trim() ?? "";
  if (!prompt) throw new CursorCloudError("Pass a prompt for Cursor to do.");
  if (prompt.length > MAX_CURSOR_PROMPT) {
    throw new CursorCloudError("That prompt is too long.");
  }
  const ref = input.ref?.trim() || undefined;
  if (ref && ref.length > MAX_CURSOR_REF) {
    throw new CursorCloudError("That starting ref is too long.");
  }
  return {
    repo: normalizeGithubRepoUrl(input.repo ?? ""),
    prompt,
    ref,
  };
}

export function cursorCreateBody(input: {
  repo: string;
  prompt: string;
  ref?: string;
}): Record<string, unknown> {
  const repo: Record<string, string> = { url: input.repo };
  if (input.ref) repo.startingRef = input.ref;
  return {
    prompt: { text: input.prompt },
    repos: [repo],
    autoCreatePR: true,
  };
}

export function cursorAuthHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCursorLaunchResponse(
  value: unknown,
  repo: string,
): CursorCloudLaunch {
  const row = asRecord(value);
  const agent = asRecord(row?.agent) ?? row;
  const run = asRecord(row?.run);
  const agentId = asString(agent?.id);
  const runId = asString(run?.id) || asString(agent?.latestRunId);
  if (!agentId || !runId) {
    throw new CursorCloudError("Cursor did not return an agent id.");
  }
  return {
    agentId,
    runId,
    name: asString(agent?.name) || "Cursor cloud agent",
    repo,
    url: asString(agent?.url) || `https://cursor.com/agents/${agentId}`,
  };
}

function firstPrUrl(git: unknown): { prUrl?: string; branch?: string } {
  const row = asRecord(git);
  const branches = Array.isArray(row?.branches) ? row.branches : [];
  for (const item of branches) {
    const branch = asRecord(item);
    const prUrl = asString(branch?.prUrl);
    if (prUrl) {
      return { prUrl, branch: asString(branch?.branch) || undefined };
    }
  }
  const first = asRecord(branches[0]);
  return { branch: asString(first?.branch) || undefined };
}

export function parseCursorRunResponse(value: unknown): CursorCloudRun {
  const row = asRecord(value);
  if (!row) throw new CursorCloudError("Cursor run was empty.");
  const id = asString(row.id);
  const agentId = asString(row.agentId);
  const status = asString(row.status) || "RUNNING";
  if (!id || !agentId) {
    throw new CursorCloudError("Cursor run was missing ids.");
  }
  const git = firstPrUrl(row.git);
  const result = asString(row.result) || undefined;
  return {
    id,
    agentId,
    status,
    result,
    prUrl: git.prUrl,
    branch: git.branch,
  };
}

export function isCursorRunTerminal(status: string): boolean {
  return (
    status === "FINISHED" ||
    status === "ERROR" ||
    status === "CANCELLED" ||
    status === "EXPIRED"
  );
}

export function cursorPollDelayMs(attempt: number): number {
  if (attempt <= 0) return 20_000;
  if (attempt === 1) return 45_000;
  return 60_000;
}

export function parseCursorDispatchPayload(
  value: unknown,
): CursorDispatchPayload | null {
  const row = asRecord(value);
  if (!row) return null;
  const agentId = asString(row.agentId);
  const runId = asString(row.runId);
  const repo = asString(row.repo);
  const prompt = asString(row.prompt);
  const attempt =
    typeof row.attempt === "number" && Number.isSafeInteger(row.attempt)
      ? row.attempt
      : 0;
  if (!agentId || !runId || !repo) return null;
  return { agentId, runId, repo, prompt, attempt };
}

export function cursorParkedCopy(repo: string): string {
  return `I'm on it — Cursor is coding in ${shortGithubRepo(repo)}.`;
}

export function cursorProofCopy(run: {
  repo: string;
  status: string;
  prUrl?: string;
  result?: string;
}): string {
  const repo = shortGithubRepo(run.repo);
  if (run.prUrl) return `Cursor opened ${run.prUrl}`;
  if (run.status === "FINISHED") {
    const result = run.result?.trim();
    return result
      ? `Cursor finished on ${repo}. ${result}`
      : `Cursor finished on ${repo}. No pull request yet.`;
  }
  if (run.status === "CANCELLED") {
    return `Cursor stopped on ${repo}.`;
  }
  if (run.status === "EXPIRED") {
    return `Cursor timed out on ${repo}.`;
  }
  const result = run.result?.trim();
  return result
    ? `Cursor failed on ${repo}. ${result}`
    : `Cursor failed on ${repo}.`;
}

async function readCursorJson(
  response: Response,
  fallback: string,
): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    if (!response.ok) throw new CursorCloudError(fallback);
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    if (!response.ok) throw new CursorCloudError(fallback);
    throw new CursorCloudError("Cursor returned a non-JSON response.");
  }
}

function cursorHttpError(status: number, body: unknown): CursorCloudError {
  const row = asRecord(body);
  const message =
    asString(row?.message) ||
    asString(row?.error) ||
    asString(asRecord(row?.error)?.message);
  if (status === 401 || status === 403) {
    return new CursorCloudError(
      "Cursor rejected that API key. Paste a Cloud Agents key in Settings → Models.",
    );
  }
  return new CursorCloudError(message || `Cursor HTTP ${status}.`);
}

export async function createCursorCloudAgent(opts: {
  apiKey: string;
  repo: string;
  prompt: string;
  ref?: string;
  fetch?: CursorFetch;
}): Promise<CursorCloudLaunch> {
  const parsed = parseCursorLaunchInput(opts);
  const runFetch = opts.fetch ?? fetch;
  const response = await runFetch(`${CURSOR_CLOUD_API}/agents`, {
    method: "POST",
    headers: cursorAuthHeaders(opts.apiKey),
    body: JSON.stringify(cursorCreateBody(parsed)),
  });
  const body = await readCursorJson(response, "Cursor could not start.");
  if (!response.ok) throw cursorHttpError(response.status, body);
  return parseCursorLaunchResponse(body, parsed.repo);
}

export async function getCursorCloudRun(opts: {
  apiKey: string;
  agentId: string;
  runId: string;
  fetch?: CursorFetch;
}): Promise<CursorCloudRun> {
  const agentId = opts.agentId.trim();
  const runId = opts.runId.trim();
  if (!agentId || !runId) {
    throw new CursorCloudError("Missing Cursor agent or run id.");
  }
  const runFetch = opts.fetch ?? fetch;
  const response = await runFetch(
    `${CURSOR_CLOUD_API}/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
    {
      method: "GET",
      headers: cursorAuthHeaders(opts.apiKey),
    },
  );
  const body = await readCursorJson(response, "Cursor run lookup failed.");
  if (!response.ok) throw cursorHttpError(response.status, body);
  return parseCursorRunResponse(body);
}
