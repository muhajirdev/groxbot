import { describe, expect, it } from "vitest";
import {
  BENTO_CHAT_BASE_URL,
  BENTO_CHAT_SDK_SRC,
  BENTO_CHAT_WEBSITE_TOKEN,
  supportChatSettings,
  supportChatUser,
} from "./support-chat";

describe("support chat", () => {
  it("points at the Bento Chatwoot inbox", () => {
    expect(BENTO_CHAT_SDK_SRC).toBe(`${BENTO_CHAT_BASE_URL}/packs/js/sdk.js`);
    expect(BENTO_CHAT_WEBSITE_TOKEN).toHaveLength(24);
  });

  it("hides the launcher in the office", () => {
    expect(supportChatSettings({ hideBubble: true })).toMatchObject({
      hideMessageBubble: true,
      position: "right",
    });
    expect(supportChatSettings().hideMessageBubble).toBe(false);
  });

  it("identifies a signed-in teammate", () => {
    expect(
      supportChatUser({
        userId: "usr_1",
        email: "founder@groxbot.com",
        name: "Muhajir",
      }),
    ).toEqual({
      identifier: "usr_1",
      email: "founder@groxbot.com",
      name: "Muhajir",
    });
    expect(supportChatUser(null)).toBeUndefined();
  });
});
