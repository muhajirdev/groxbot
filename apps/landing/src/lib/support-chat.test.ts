import { describe, expect, it } from "vitest";
import {
  BENTO_CHAT_BASE_URL,
  BENTO_CHAT_SDK_SRC,
  BENTO_CHAT_WEBSITE_TOKEN,
  supportChatSettings,
} from "./support-chat";

describe("support chat", () => {
  it("points at the Bento Chatwoot inbox", () => {
    expect(BENTO_CHAT_SDK_SRC).toBe(`${BENTO_CHAT_BASE_URL}/packs/js/sdk.js`);
    expect(BENTO_CHAT_WEBSITE_TOKEN).toHaveLength(24);
  });

  it("keeps the launcher on the marketing site", () => {
    expect(supportChatSettings()).toMatchObject({
      hideMessageBubble: false,
      darkMode: "dark",
      position: "right",
    });
  });
});
