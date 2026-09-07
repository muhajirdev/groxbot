import { useEffect, useState } from "react";
import { GROXBOT_DISCORD_URL } from "../lib/support-chat";

export function SupportChatLink() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="foot-chat"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Chat
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="support-scrim"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            className="support-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-title"
          >
            <h2 id="support-title">Get help on Discord</h2>
            <p>Fastest response — join the Groxbot server and ask there.</p>
            <div className="support-actions">
              <button
                type="button"
                className="support-dismiss"
                onClick={() => setOpen(false)}
              >
                Not now
              </button>
              <a
                className="btn"
                href={GROXBOT_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Join Discord
              </a>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
