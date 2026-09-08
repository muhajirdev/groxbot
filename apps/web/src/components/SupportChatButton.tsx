import { HelpIcon } from "./Icons";

export function SupportChatButton(props: { onClick: () => void }) {
  return (
    <button
      className="no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
      type="button"
      aria-label="Chat with support"
      title="Chat with support"
      onClick={props.onClick}
    >
      <HelpIcon />
    </button>
  );
}
