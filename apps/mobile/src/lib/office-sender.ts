import { parseOfficeUserMeta } from "@groxbot/contracts";

export type OfficeMessageSender = {
  label: string;
  mine: boolean;
};

export function officeUserMessageSender(
  metadata: unknown,
  viewerUserId?: string,
): OfficeMessageSender | null {
  const user = parseOfficeUserMeta(metadata);
  if (!user) return null;
  const mine = !viewerUserId || user.userId === viewerUserId;
  return {
    label: mine && viewerUserId ? "You" : user.name,
    mine,
  };
}
