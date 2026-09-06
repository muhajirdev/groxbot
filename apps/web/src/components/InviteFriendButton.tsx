import { useState } from "react";
import { userFacingError } from "../lib/errors";
import { client } from "../lib/rpc";
import { copyAndToast, toast, TOAST_INVITE_LINK_COPIED } from "../lib/toast";
import { PeoplePlusIcon } from "./Icons";

export function InviteFriendButton() {
  const [busy, setBusy] = useState(false);

  async function copyInvite() {
    if (busy) return;
    setBusy(true);
    try {
      const { url } = await client.workspaces.inviteLink();
      const copied = await copyAndToast(url, TOAST_INVITE_LINK_COPIED);
      if (!copied) toast(url);
    } catch (caught) {
      toast(userFacingError(caught, "Could not create an invite link"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
      aria-label="Invite a friend"
      disabled={busy}
      onClick={() => void copyInvite()}
    >
      <PeoplePlusIcon />
    </button>
  );
}
