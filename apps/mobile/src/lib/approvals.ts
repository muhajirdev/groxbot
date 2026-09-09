export type PendingApproval = {
  executionId: string;
  seq: number;
  connector: string;
  method: string;
  args: unknown;
};

export function parsePendingApprovals(value: unknown): PendingApproval[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const action = row as Record<string, unknown>;
    return typeof action.executionId === "string" &&
      typeof action.seq === "number" &&
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

export function approvalSummary(action: PendingApproval): string {
  if (action.connector === "bots" && action.method === "hire") {
    const args = action.args as { name?: unknown; title?: unknown } | null;
    const name = typeof args?.name === "string" ? args.name : "this teammate";
    const title = typeof args?.title === "string" ? ` — ${args.title}` : "";
    return `Hire ${name}${title}`;
  }
  return `${action.connector}.${action.method}`;
}
