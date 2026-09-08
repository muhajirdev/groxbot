import { openCrispChat } from "../lib/support-chat";

export function SupportChatLink() {
  return (
    <button
      type="button"
      className="foot-chat"
      onClick={() => openCrispChat()}
    >
      Chat
    </button>
  );
}
