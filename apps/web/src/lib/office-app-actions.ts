import type { TemplateId } from "@groxbot/contracts";
import { createContext, useContext } from "react";

export type OfficeAppOpen = {
  appId: string;
  templateId: TemplateId;
  title: string;
};

export type OfficeAppActions = {
  open: (app: OfficeAppOpen) => void;
  remember?: (app: OfficeAppOpen) => void;
};

export const OfficeAppActionsContext = createContext<OfficeAppActions | null>(
  null,
);

export function useOfficeAppActions(): OfficeAppActions | null {
  return useContext(OfficeAppActionsContext);
}
