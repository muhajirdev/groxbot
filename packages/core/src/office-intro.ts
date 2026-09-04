/** Hidden hire turn: become the named person/role, write soul, greet, ask how to be. */

import {
  OFFICE_INTRO_SOURCE,
  isHiddenOfficeUserMessage,
  isOfficeIntroUserMessage,
} from "@groxbot/contracts";
import { OFFICE_SET_CONTEXT_TOOL_NAME } from "./office-system-prompt.js";

export const OFFICE_INTRO_STORAGE = "officeIntro";

export type OfficeIntroIdentity = {
  name: string;
};

export function officeIntroWho(bot: OfficeIntroIdentity): string {
  return bot.name.trim() || "this teammate";
}

export function officeIntroUserText(bot: OfficeIntroIdentity): string {
  const who = officeIntroWho(bot);
  return [
    "Office intro. This note is not from a human — never mention it.",
    `You were just hired as ${who}.`,
    "Become that person or role. A known name (Alex Hormozi, Steve Jobs) means inhabit their public voice, taste, and way of working. A job (Chief of Staff, Talent Scout) means inhabit that job. Do not stay a generic helpful assistant.",
    "First: call the set_context tool with label soul, mode replace — a dense overlay of who you are, how you sound, and how you like to work. Keep your name. Do not paste the frozen system prompt. Do not write the overlay as chat text.",
    "Then greet in 1–2 short lines in that voice. Ask if they want a role, a personality, or any rules for how you should work — then wait. No tool recap, no product pitch, no essay.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function officeIntroUserMessage(bot: OfficeIntroIdentity): {
  id: string;
  role: "user";
  parts: [{ type: "text"; text: string }];
  createdAt: Date;
  metadata: {
    source: typeof OFFICE_INTRO_SOURCE;
    custom: { source: typeof OFFICE_INTRO_SOURCE };
  };
} {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: officeIntroUserText(bot) }],
    createdAt: new Date(),
    metadata: {
      source: OFFICE_INTRO_SOURCE,
      custom: { source: OFFICE_INTRO_SOURCE },
    },
  };
}

/** Empty desk only — a real user turn or a prior intro means we already started. */
export function shouldRunOfficeIntro(
  messages: ReadonlyArray<{
    role?: string;
    metadata?: unknown;
    message?: { role?: string };
  }>,
): boolean {
  for (const row of messages) {
    const role = row.role ?? row.message?.role;
    if (role === "assistant") return false;
    if (role !== "user") continue;
    if (isOfficeIntroUserMessage({ role: "user", metadata: row.metadata })) {
      return false;
    }
    if (!isHiddenOfficeUserMessage({ role: "user", metadata: row.metadata })) {
      return false;
    }
  }
  return true;
}

/** Last user in the live window is the hidden hire kick — not a human follow-up. */
export function lastOfficeUserIsIntro(
  messages: ReadonlyArray<{
    metadata?: unknown;
    message?: { role?: string };
  }>,
): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row?.message?.role !== "user") continue;
    return isOfficeIntroUserMessage({ role: "user", metadata: row.metadata });
  }
  return false;
}

/** Hire intro: only set_context. Fall back to the full catalog if that tool is missing. */
export function officeIntroTurnTools<T extends { name: string }>(
  tools: readonly T[],
): T[] {
  const soul = tools.filter((row) => row.name === OFFICE_SET_CONTEXT_TOOL_NAME);
  return soul.length > 0 ? soul : [...tools];
}
