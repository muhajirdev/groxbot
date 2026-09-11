import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  OFFICE_STAMP_APP_TOOL_NAME,
  parseOfficeAppCard,
} from "@groxbot/core/browser";
import { type ReactNode, useEffect } from "react";
import { useOfficeAppActions } from "../lib/office-app-actions";
import { AppCard } from "./AppCard";

export function StampAppSurface(props: {
  args: unknown;
  result?: unknown;
}): ReactNode {
  const card =
    parseOfficeAppCard(props.args) ?? parseOfficeAppCard(props.result);
  const actions = useOfficeAppActions();
  useEffect(() => {
    if (!card) return;
    actions?.remember?.(card);
  }, [actions, card?.appId, card?.templateId, card?.title]);
  if (!card) return null;
  return (
    <AppCard
      templateId={card.templateId}
      title={card.title}
      onOpen={() => actions?.open(card)}
    />
  );
}

export const StampAppToolUI = makeAssistantToolUI({
  toolName: OFFICE_STAMP_APP_TOOL_NAME,
  display: "standalone",
  render: ({ args, result }) => <StampAppSurface args={args} result={result} />,
});
