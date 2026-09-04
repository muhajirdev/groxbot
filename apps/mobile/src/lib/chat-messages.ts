import {
  lastProjectedPreview,
  type PiBoundMessage,
  projectPiBoundMessages,
} from "@groxbot/core/browser";
import { lastOfficePreview, parseOfficeMessages } from "./office-messages";

export function lastUiPreview(messages: PiBoundMessage[]): string {
  return lastProjectedPreview(projectPiBoundMessages(messages));
}

/** @deprecated UIMessage-shaped helper kept for app-card tests. */
export function lastLegacyOfficePreview(payload: unknown): string {
  return lastOfficePreview(parseOfficeMessages(payload));
}
