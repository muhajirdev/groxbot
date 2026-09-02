import { parseOfficeUserMeta } from "@groxbot/contracts";

export type OfficeMessageSender = {
  label: string;
  mine: boolean;
};

/** Label a human Think message for the thread. Own turns say "You". */
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
