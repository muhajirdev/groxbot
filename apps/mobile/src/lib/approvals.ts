import {
  officeApprovalSummary,
  parseOfficePendingActions,
  type OfficePendingAction,
} from "@groxbot/core/browser";

export type PendingApproval = OfficePendingAction;

export const parsePendingApprovals = parseOfficePendingActions;
export const approvalSummary = officeApprovalSummary;
