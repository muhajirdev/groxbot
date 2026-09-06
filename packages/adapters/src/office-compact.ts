/** Compact the office Pi session the way the coding-agent harness does. */

import {
  convertToLlm as harnessConvertToLlm,
  DEFAULT_COMPACTION_SETTINGS,
  estimateContextTokens,
  prepareCompaction,
  serializeConversation,
  Session,
  shouldCompact,
  type CompactionSettings,
} from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import {
  OFFICE_COMPACT_KEEP_RECENT_TOKENS,
  OFFICE_COMPACT_PROMPT,
  OFFICE_COMPACT_RESERVE_TOKENS,
  OFFICE_COMPACT_SYSTEM,
  OFFICE_COMPACT_UPDATE_PROMPT,
  officeModelContextWindow,
  pruneLiveToolResults,
} from "@groxbot/core";
import { runPiTurn, type StreamFn } from "./pi-turn.js";

export const OFFICE_COMPACTION_SETTINGS: CompactionSettings = {
  ...DEFAULT_COMPACTION_SETTINGS,
  reserveTokens: OFFICE_COMPACT_RESERVE_TOKENS,
  keepRecentTokens: OFFICE_COMPACT_KEEP_RECENT_TOKENS,
};

export async function compactOfficeSession(
  session: Session,
  opts: {
    model: Model<Api>;
    streamFn: StreamFn;
    signal?: AbortSignal;
    contextWindow?: number;
    settings?: Partial<CompactionSettings>;
    force?: boolean;
  },
): Promise<boolean> {
  const settings: CompactionSettings = {
    ...OFFICE_COMPACTION_SETTINGS,
    ...opts.settings,
  };
  if (!settings.enabled && !opts.force) return false;
  const branch = await session.getBranch();
  if (branch.length === 0) return false;
  const context = await session.buildContext();
  const estimated = estimateContextTokens(
    pruneLiveToolResults(context.messages),
  );
  const window =
    opts.contextWindow ?? officeModelContextWindow(opts.model);
  if (
    !opts.force &&
    !shouldCompact(estimated.tokens, window, settings)
  ) {
    return false;
  }
  const prepared = prepareCompaction(branch, settings);
  if (!prepared.ok || !prepared.value) return false;
  const prep = prepared.value;
  if (
    prep.messagesToSummarize.length === 0 &&
    prep.turnPrefixMessages.length === 0
  ) {
    return false;
  }
  const summary = await summarizeOfficeHistory(prep.messagesToSummarize, {
    model: opts.model,
    streamFn: opts.streamFn,
    signal: opts.signal,
    previousSummary: prep.previousSummary,
    turnPrefix: prep.isSplitTurn ? prep.turnPrefixMessages : undefined,
  });
  if (!summary) return false;
  await session.appendCompaction(
    summary,
    prep.firstKeptEntryId,
    prep.tokensBefore,
    undefined,
    false,
    undefined,
    prep.retainedTail,
  );
  return true;
}

async function summarizeOfficeHistory(
  messages: Parameters<typeof harnessConvertToLlm>[0],
  opts: {
    model: Model<Api>;
    streamFn: StreamFn;
    signal?: AbortSignal;
    previousSummary?: string;
    turnPrefix?: Parameters<typeof harnessConvertToLlm>[0];
  },
): Promise<string | null> {
  const conversation = serializeConversation(compactLlmMessages(messages));
  let prompt = `<conversation>\n${conversation}\n</conversation>\n\n`;
  if (opts.turnPrefix?.length) {
    const prefix = serializeConversation(compactLlmMessages(opts.turnPrefix));
    prompt += `<turn-prefix>\n${prefix}\n</turn-prefix>\n\n`;
  }
  if (opts.previousSummary) {
    prompt += `<previous-summary>\n${opts.previousSummary}\n</previous-summary>\n\n`;
    prompt += OFFICE_COMPACT_UPDATE_PROMPT;
  } else {
    prompt += OFFICE_COMPACT_PROMPT;
  }
  const result = await runPiTurn({
    systemPrompt: OFFICE_COMPACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      },
    ],
    model: opts.model,
    streamFn: opts.streamFn,
    signal: opts.signal,
  });
  if (result.stopReason === "aborted") return null;
  if (result.stopReason === "error" || !result.text.trim()) return null;
  return result.text.trim();
}

function compactLlmMessages(
  messages: Parameters<typeof harnessConvertToLlm>[0],
) {
  return pruneLiveToolResults(harnessConvertToLlm(messages), {
    maxChars: 800,
    staleChars: 800,
  });
}
