import { createContext, useContext } from "react";
import type { OfficePendingAction } from "@groxbot/core/browser";

export type OfficeApprovalActions = {
  approve: (action: OfficePendingAction) => Promise<void>;
  reject: (action: OfficePendingAction) => Promise<void>;
};

export const OfficeApprovalActionsContext =
  createContext<OfficeApprovalActions | null>(null);

export function useOfficeApprovalActions(): OfficeApprovalActions | null {
  return useContext(OfficeApprovalActionsContext);
}
