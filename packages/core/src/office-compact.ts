/** Office live-window compact. The Pi session stays whole; buildContext slices it. */

export const HOSTED_OFFICE_CONTEXT_WINDOW = 1_048_576;
export const OFFICE_COMPACT_RESERVE_TOKENS = 16_384;
export const OFFICE_COMPACT_KEEP_RECENT_TOKENS = 20_000;

export const OFFICE_COMPACT_SYSTEM =
  "You are a context summarization assistant for an office teammate. Read the conversation, then produce a structured summary following the exact format specified. Do NOT continue the conversation. Do NOT answer questions in it. ONLY output the structured summary.";

export const OFFICE_COMPACT_PROMPT = `The messages above are this office thread. Create a structured checkpoint another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What the user is trying to accomplish. Can be several items.]

## Constraints & Preferences
- [Constraints, preferences, accounts, or requirements]
- [Or "(none)"]

## Progress
### Done
- [x] [Completed work]

### In Progress
- [ ] [Current work]

### Blocked
- [Blockers, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Facts, names, routine ids, computer or knowledge paths needed to continue]
- [Or "(none)"]

Keep each section concise. Preserve exact paths, slugs, and error messages.`;

export const OFFICE_COMPACT_UPDATE_PROMPT = `The messages above are NEW turns to fold into the existing summary in <previous-summary>.

Update that structured summary. RULES:
- PRESERVE existing information
- ADD new progress, decisions, and context
- Move finished work from In Progress to Done
- UPDATE Next Steps
- PRESERVE exact paths, slugs, and error messages

Use the same EXACT format as before.`;

export function isContextOverflowError(message?: string | null): boolean {
  const text = (message ?? "").toLowerCase();
  if (!text.trim()) return false;
  return (
    text.includes("8007") ||
    text.includes("context length") ||
    text.includes("context window") ||
    text.includes("maximum context") ||
    /input \d+ tokens\s*>/.test(text) ||
    /prompt is too long/.test(text)
  );
}

export function officeModelContextWindow(model: {
  id?: string;
  contextWindow?: number;
}): number {
  const listed = model.contextWindow ?? 0;
  const id = (model.id ?? "").toLowerCase();
  if (id.includes("glm-5.3") || id.includes("glm-5.2")) {
    return Math.max(listed, HOSTED_OFFICE_CONTEXT_WINDOW);
  }
  if (id.includes("groxbot/") || id === "auto" || id === "free") {
    return Math.max(listed, HOSTED_OFFICE_CONTEXT_WINDOW);
  }
  if (listed >= 256_000) return listed;
  if (listed > 0 && !id.includes("workers-ai/") && !id.includes("@cf/")) {
    return listed;
  }
  if (listed > 0) return Math.max(listed, HOSTED_OFFICE_CONTEXT_WINDOW);
  return HOSTED_OFFICE_CONTEXT_WINDOW;
}
