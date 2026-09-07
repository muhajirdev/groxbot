import { GROXBOT_DISCORD_URL } from "../lib/support-chat";
import { Button, ModalShell } from "../ui";
import { ChatIcon } from "./Icons";

export function SupportDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <ModalShell
      open={props.open}
      className="w-[min(380px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <div className="grid gap-3.5">
        <div className="grid gap-1.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Get help on Discord
          </h2>
          <p className="m-0 text-[12px] leading-5 text-muted">
            Fastest response — join the Groxbot server and ask there.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button variant="text" type="button" onClick={props.onClose}>
            Not now
          </Button>
          <a
            className="inline-flex items-center rounded-pill bg-ink px-3 py-1.5 text-[13px] font-semibold tracking-tight text-[var(--bg)] no-underline outline-none focus-visible:ring-2 focus-visible:ring-accent"
            href={GROXBOT_DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Join Discord
          </a>
        </div>
      </div>
    </ModalShell>
  );
}

export function SupportChatButton(props: { onClick: () => void }) {
  return (
    <button
      className="no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
      type="button"
      aria-label="Chat with support"
      title="Chat with support"
      aria-haspopup="dialog"
      onClick={props.onClick}
    >
      <ChatIcon />
    </button>
  );
}
