import { createContext, useContext } from "react";

export type OfficeAskActions = {
  answer: (toolCallId: string, answers: unknown) => Promise<void>;
  skip: (toolCallId: string) => Promise<void>;
};

export const OfficeAskActionsContext = createContext<OfficeAskActions | null>(
  null,
);

export function useOfficeAskActions(): OfficeAskActions | null {
  return useContext(OfficeAskActionsContext);
}
