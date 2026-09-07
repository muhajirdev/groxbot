import { useEffect } from "react";
import { loadSupportChat, openSupportChat } from "../lib/support-chat";

export function SupportChatWidget() {
  useEffect(() => {
    void loadSupportChat({ hideBubble: false, darkMode: "dark" });
  }, []);
  return null;
}

export function SupportChatLink() {
  return (
    <button
      type="button"
      className="foot-chat"
      onClick={() => void openSupportChat()}
    >
      Chat
    </button>
  );
}
