/** Top-level `ask` — the office harness pauses until the human answers. */

export const OFFICE_ASK_TOOL_NAME = "ask";

export const MAX_ASK_QUESTIONS = 4;
export const MAX_ASK_OPTIONS = 6;
export const MAX_ASK_PROMPT_CHARS = 280;
export const MAX_ASK_OPTION_CHARS = 80;

export const OFFICE_ASK_TOOL_DESCRIPTION = [
  "Ask the human one or more questions and wait for the answer. Use when a preference or a missing fact blocks the work.",
  "Prefer 2–4 short options. One call can hold several questions. Do not use this to narrate, and do not use it for hire/send/spend/delete — those still need approval.",
  "Pass `questions` (prompt plus optional options). A single `question` string also works.",
].join(" ");

export type OfficeAskOption = {
  id: string;
  label: string;
};

export type OfficeAskQuestion = {
  id: string;
  prompt: string;
  options: OfficeAskOption[];
  multi: boolean;
};

export type OfficeAskPrompt = {
  toolCallId: string;
  questions: OfficeAskQuestion[];
};

export type OfficeAskSkipReason = "skipped" | "aborted" | "unattended";

export type OfficeAskAnswer = {
  id: string;
  prompt: string;
  value: string;
};

export type OfficeAskResult = {
  ok: true;
  skipped: boolean;
  reason?: OfficeAskSkipReason;
  answers: OfficeAskAnswer[];
  message: string;
};

export type OfficeAskParseFail = {
  ok: false;
  message: string;
};

function clip(text: string, max: number): string {
  const next = text.replace(/\s+/g, " ").trim();
  if (next.length <= max) return next;
  return `${next.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function slug(text: string, used: Set<string>, fallback: string): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || fallback;
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionFrom(value: unknown, used: Set<string>, index: number): OfficeAskOption | null {
  if (typeof value === "string") {
    const label = clip(value, MAX_ASK_OPTION_CHARS);
    if (!label) return null;
    return { id: slug(label, used, `opt-${index + 1}`), label };
  }
  const row = asRecord(value);
  if (!row) return null;
  const label = clip(
    typeof row.label === "string"
      ? row.label
      : typeof row.text === "string"
        ? row.text
        : "",
    MAX_ASK_OPTION_CHARS,
  );
  if (!label) return null;
  const requested = typeof row.id === "string" ? row.id.trim() : "";
  const id = requested && !used.has(requested)
    ? (used.add(requested), requested)
    : slug(label, used, `opt-${index + 1}`);
  return { id, label };
}

function questionFrom(
  value: unknown,
  used: Set<string>,
  index: number,
): OfficeAskQuestion | null {
  if (typeof value === "string") {
    const prompt = clip(value, MAX_ASK_PROMPT_CHARS);
    if (!prompt) return null;
    return {
      id: slug(prompt, used, `q-${index + 1}`),
      prompt,
      options: [],
      multi: false,
    };
  }
  const row = asRecord(value);
  if (!row) return null;
  const prompt = clip(
    typeof row.prompt === "string"
      ? row.prompt
      : typeof row.question === "string"
        ? row.question
        : typeof row.text === "string"
          ? row.text
          : "",
    MAX_ASK_PROMPT_CHARS,
  );
  if (!prompt) return null;
  const requested = typeof row.id === "string" ? row.id.trim() : "";
  const id = requested && !used.has(requested)
    ? (used.add(requested), requested)
    : slug(prompt, used, `q-${index + 1}`);
  const optionUsed = new Set<string>();
  const rawOptions = Array.isArray(row.options) ? row.options : [];
  const options: OfficeAskOption[] = [];
  for (const [i, item] of rawOptions.entries()) {
    if (options.length >= MAX_ASK_OPTIONS) break;
    const option = optionFrom(item, optionUsed, i);
    if (option) options.push(option);
  }
  return {
    id,
    prompt,
    options,
    multi: row.multi === true || row.multiSelect === true,
  };
}

function questionsFromInput(input: unknown): OfficeAskQuestion[] {
  const row = asRecord(input);
  if (!row) {
    if (typeof input === "string") {
      const prompt = clip(input, MAX_ASK_PROMPT_CHARS);
      return prompt
        ? [{ id: "q-1", prompt, options: [], multi: false }]
        : [];
    }
    return [];
  }
  const used = new Set<string>();
  const out: OfficeAskQuestion[] = [];
  const listed = Array.isArray(row.questions) ? row.questions : null;
  if (listed) {
    for (const [i, item] of listed.entries()) {
      if (out.length >= MAX_ASK_QUESTIONS) break;
      const question = questionFrom(item, used, i);
      if (question) out.push(question);
    }
    return out;
  }
  const single = questionFrom(
    {
      prompt: row.question ?? row.prompt,
      options: row.options,
      multi: row.multi ?? row.multiSelect,
      id: row.id,
    },
    used,
    0,
  );
  return single ? [single] : [];
}

export function parseOfficeAskInput(
  input: unknown,
): { ok: true; questions: OfficeAskQuestion[] } | OfficeAskParseFail {
  const questions = questionsFromInput(input);
  if (questions.length === 0) {
    return {
      ok: false,
      message:
        "ask needs a question. Pass { question } or { questions: [{ prompt, options }] }.",
    };
  }
  return { ok: true, questions };
}

export function officeAskPrompt(
  toolCallId: string,
  questions: OfficeAskQuestion[],
): OfficeAskPrompt {
  return { toolCallId, questions };
}

export function officeAskSkipped(reason: OfficeAskSkipReason): OfficeAskResult {
  const message =
    reason === "unattended"
      ? "No human is watching this turn. Use your best judgment and continue."
      : reason === "aborted"
        ? "The human stopped this turn."
        : "The human skipped. Use your best judgment or ask again.";
  return { ok: true, skipped: true, reason, answers: [], message };
}

function selectedLabels(
  question: OfficeAskQuestion,
  selected: string[],
  text: string,
): string {
  const labels = selected.flatMap((id) => {
    const option = question.options.find((row) => row.id === id || row.label === id);
    return option ? [option.label] : id.trim() ? [id.trim()] : [];
  });
  const extra = clip(text, MAX_ASK_PROMPT_CHARS);
  const parts = [...labels, extra].filter(Boolean);
  return parts.join(", ");
}

function answersFromPayload(
  questions: OfficeAskQuestion[],
  payload: unknown,
): OfficeAskAnswer[] | null {
  const row = asRecord(payload);
  if (!row) {
    if (typeof payload === "string" && questions[0]) {
      const value = clip(payload, MAX_ASK_PROMPT_CHARS);
      return value
        ? [{ id: questions[0].id, prompt: questions[0].prompt, value }]
        : null;
    }
    return null;
  }
  if (row.skipped === true) return [];
  const listed = Array.isArray(row.answers) ? row.answers : null;
  if (listed) {
    const out: OfficeAskAnswer[] = [];
    for (const item of listed) {
      const answer = asRecord(item);
      if (!answer) continue;
      const question =
        questions.find((q) => q.id === answer.id) ??
        questions.find((q) => q.prompt === answer.prompt) ??
        (out.length < questions.length ? questions[out.length] : undefined);
      if (!question) continue;
      const selected = Array.isArray(answer.selected)
        ? answer.selected.filter((id): id is string => typeof id === "string")
        : typeof answer.selected === "string"
          ? [answer.selected]
          : typeof answer.value === "string"
            ? [answer.value]
            : [];
      const text = typeof answer.text === "string" ? answer.text : "";
      const value = selectedLabels(question, selected, text);
      if (!value) continue;
      out.push({ id: question.id, prompt: question.prompt, value });
    }
    return out.length > 0 ? out : null;
  }
  if (questions.length === 1 && questions[0]) {
    const selected = Array.isArray(row.selected)
      ? row.selected.filter((id): id is string => typeof id === "string")
      : typeof row.selected === "string"
        ? [row.selected]
        : typeof row.value === "string"
          ? [row.value]
          : [];
    const text = typeof row.text === "string" ? row.text : "";
    const value = selectedLabels(questions[0], selected, text);
    if (!value) return null;
    return [{ id: questions[0].id, prompt: questions[0].prompt, value }];
  }
  return null;
}

export function applyOfficeAskAnswers(
  prompt: OfficeAskPrompt,
  payload: unknown,
): OfficeAskResult {
  const row = asRecord(payload);
  if (row?.skipped === true) return officeAskSkipped("skipped");
  const answers = answersFromPayload(prompt.questions, payload);
  if (!answers || answers.length === 0) {
    return officeAskSkipped("skipped");
  }
  return {
    ok: true,
    skipped: false,
    answers,
    message: answers.map((row) => `${row.prompt}: ${row.value}`).join("\n"),
  };
}

export function parseOfficeAskPrompt(value: unknown): OfficeAskPrompt | null {
  const row = asRecord(value);
  if (!row || typeof row.toolCallId !== "string" || !row.toolCallId.trim()) {
    return null;
  }
  const parsed = parseOfficeAskInput(row);
  if (!parsed.ok) return null;
  return { toolCallId: row.toolCallId, questions: parsed.questions };
}

export function parsePendingAsks(value: unknown): OfficeAskPrompt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const prompt = parseOfficeAskPrompt(row);
    return prompt ? [prompt] : [];
  });
}

export function parseOfficeAskArgs(value: unknown): OfficeAskQuestion[] {
  const parsed = parseOfficeAskInput(value);
  return parsed.ok ? parsed.questions : [];
}

export function parseOfficeAskResult(value: unknown): OfficeAskResult | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return parseOfficeAskResult(JSON.parse(trimmed));
    } catch {
      return {
        ok: true,
        skipped: /skipped|best judgment|no human/i.test(trimmed),
        answers: [],
        message: trimmed,
      };
    }
  }
  const row = asRecord(value);
  if (!row || row.ok === false) return null;
  const skipped = row.skipped === true;
  const reason =
    row.reason === "skipped" ||
    row.reason === "aborted" ||
    row.reason === "unattended"
      ? row.reason
      : undefined;
  const answers = Array.isArray(row.answers)
    ? row.answers.flatMap((item) => {
        const answer = asRecord(item);
        if (!answer) return [];
        const id = typeof answer.id === "string" ? answer.id : "";
        const prompt = typeof answer.prompt === "string" ? answer.prompt : "";
        const text = typeof answer.value === "string" ? answer.value : "";
        return id && prompt && text ? [{ id, prompt, value: text }] : [];
      })
    : [];
  const message =
    typeof row.message === "string" && row.message.trim()
      ? row.message.trim()
      : skipped
        ? officeAskSkipped(reason ?? "skipped").message
        : answers.map((row) => `${row.prompt}: ${row.value}`).join("\n");
  if (!message) return null;
  return { ok: true, skipped, reason, answers, message };
}
