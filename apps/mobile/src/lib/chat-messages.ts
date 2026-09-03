import type { UIMessage } from "ai";
import { lastThinkPreview, parseThinkMessages } from "./think";

export function lastUiPreview(messages: UIMessage[]): string {
  return lastThinkPreview(parseThinkMessages(messages));
}
