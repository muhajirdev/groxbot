import type { PiBoundMessage } from "@groxbot/core/browser";

const messages = new Map<string, PiBoundMessage[]>();

export function peekOfficeMessages(
  roomId: string,
): PiBoundMessage[] | undefined {
  return messages.get(roomId);
}

export function setOfficeMessages(
  roomId: string,
  next: PiBoundMessage[],
): void {
  messages.set(roomId, next);
}

export function forgetOfficeMessages(roomId: string): void {
  messages.delete(roomId);
}

export function clearOfficeMessages(): void {
  messages.clear();
}
