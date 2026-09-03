let pendingBotId = "";

export function setPendingBotId(botId: string): void {
  pendingBotId = botId;
}

export function takePendingBotId(): string {
  const id = pendingBotId;
  pendingBotId = "";
  return id;
}
