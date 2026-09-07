import { useState } from "react";
import {
  openSupportChat,
  type SupportChatUser,
  supportChatUser,
} from "../lib/support-chat";
import { toast } from "../lib/toast";
import { ChatIcon } from "./Icons";

export function SupportChatButton(props: {
  user?: Parameters<typeof supportChatUser>[0];
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      await openSupportChat(supportChatUser(props.user));
    } catch {
      toast("Could not open support chat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
      type="button"
      aria-label="Chat with support"
      title="Chat with support"
      disabled={busy}
      onClick={() => void open()}
    >
      <ChatIcon />
    </button>
  );
}

export async function openOfficeSupportChat(user?: SupportChatUser) {
  try {
    await openSupportChat(user);
  } catch {
    toast("Could not open support chat");
  }
}
