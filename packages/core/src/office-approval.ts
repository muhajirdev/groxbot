import { getBotMarketplaceTemplate } from "@groxbot/contracts";

export type OfficePendingAction = {
  executionId: string;
  seq: number;
  connector: string;
  method: string;
  args: unknown;
};

export type OfficeApprovalCopy = {
  title: string;
  detail: string;
  confirm: string;
  deny: string;
};

export type HiredTeammateRow = {
  id: string;
  name: string;
  title: string;
  homeRoomId: string;
  hint: string;
};

export type CodeModeOutput = {
  status: string;
  executionId: string;
  pending: OfficePendingAction[];
  result?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function coerceRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(value) ?? parseJsonRecord(value);
}

function contentText(value: unknown): string | undefined {
  const row = asRecord(value);
  if (!row || !Array.isArray(row.content)) return undefined;
  const chunks: string[] = [];
  for (const part of row.content) {
    const item = asRecord(part);
    if (item?.type === "text" && typeof item.text === "string" && item.text) {
      chunks.push(item.text);
    }
  }
  return chunks.join("") || undefined;
}

export function parseOfficePendingActions(value: unknown): OfficePendingAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const action = asRecord(row);
    if (!action) return [];
    return typeof action.executionId === "string" &&
      typeof action.seq === "number" &&
      Number.isSafeInteger(action.seq) &&
      typeof action.connector === "string" &&
      typeof action.method === "string"
      ? [
          {
            executionId: action.executionId,
            seq: action.seq,
            connector: action.connector,
            method: action.method,
            args: action.args,
          },
        ]
      : [];
  });
}

export function parseCodeModeOutput(value: unknown): CodeModeOutput | null {
  const text = contentText(value);
  if (text) {
    const fromContent = parseCodeModeOutput(text);
    if (fromContent) return fromContent;
  }
  const row = coerceRecord(value);
  if (!row) return null;
  const nested = coerceRecord(row.details);
  if (nested && nested !== row && typeof nested.status === "string") {
    const fromDetails = parseCodeModeOutput(nested);
    if (fromDetails) return fromDetails;
  }
  const status = typeof row.status === "string" ? row.status.trim() : "";
  if (!status) return null;
  const executionId =
    typeof row.executionId === "string" ? row.executionId.trim() : "";
  return {
    status,
    executionId,
    pending: parseOfficePendingActions(row.pending),
    result: row.result,
  };
}

export function isPausedCodeOutput(value: unknown): boolean {
  return parseCodeModeOutput(value)?.status === "paused";
}

function hireName(args: unknown): { name: string; title: string; blurb: string } {
  const row = asRecord(args);
  const marketplaceId =
    typeof row?.marketplaceId === "string" ? row.marketplaceId.trim() : "";
  if (marketplaceId) {
    const pack = getBotMarketplaceTemplate(marketplaceId);
    if (pack) {
      return {
        name: pack.name,
        title: pack.kind === "person" ? (pack.title ?? "") : "",
        blurb: pack.blurb,
      };
    }
  }
  const name = typeof row?.name === "string" && row.name.trim() ? row.name.trim() : "";
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  const instructions =
    typeof row?.instructions === "string" ? row.instructions.trim() : "";
  return {
    name: name || "this teammate",
    title,
    blurb: instructions,
  };
}

export function officeApprovalCopy(action: OfficePendingAction): OfficeApprovalCopy {
  if (action.connector === "bots" && action.method === "hire") {
    const hired = hireName(action.args);
    const title = hired.title ? `Hire ${hired.name} — ${hired.title}` : `Hire ${hired.name}`;
    const detail =
      hired.blurb ||
      "They land on the sidebar — empty desk until you write.";
    return {
      title,
      detail,
      confirm: "Hire",
      deny: "Don't hire",
    };
  }
  const args = asRecord(action.args);
  const path = typeof args?.path === "string" ? args.path.trim() : "";
  const id = typeof args?.id === "string" ? args.id.trim() : "";
  const extra = path || id;
  return {
    title: `Approve ${action.connector}.${action.method}`,
    detail: extra,
    confirm: "Approve",
    deny: "Reject",
  };
}

export function officeApprovalSummary(action: OfficePendingAction): string {
  if (action.connector === "bots" && action.method === "hire") {
    return officeApprovalCopy(action).title;
  }
  return `${action.connector}.${action.method}`;
}

function hiredRow(value: unknown): HiredTeammateRow | null {
  const row = coerceRecord(value);
  if (!row) return null;
  if (
    typeof row.id !== "string" ||
    !row.id.trim() ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    typeof row.homeRoomId !== "string" ||
    !row.homeRoomId.trim()
  ) {
    return null;
  }
  return {
    id: row.id.trim(),
    name: row.name.trim(),
    title: typeof row.title === "string" ? row.title : "",
    homeRoomId: row.homeRoomId.trim(),
    hint:
      typeof row.hint === "string" && row.hint.trim()
        ? row.hint.trim()
        : "They are on the roster. The human opens them from the sidebar — empty desk until someone writes.",
  };
}

export function hiredBotFromCodeResult(value: unknown): HiredTeammateRow | null {
  const out = parseCodeModeOutput(value);
  return hiredRow(out?.result) ?? hiredRow(value);
}

export const OFFICE_APPROVAL_REJECTED = {
  status: "rejected",
  message: "The human did not approve.",
} as const;
