import type { UIMessage } from "ai";
import { lastOfficePreview, parseOfficeMessages } from "./office-messages";

export function lastUiPreview(messages: UIMessage[]): string {
  return lastOfficePreview(parseOfficeMessages(messages));
}
