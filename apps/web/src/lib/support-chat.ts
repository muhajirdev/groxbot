/** Bento live chat (Chatwoot-compatible). Website token is public inbox id. */

export const BENTO_CHAT_BASE_URL = "https://chat.bentonow.com";
export const BENTO_CHAT_WEBSITE_TOKEN = "hRfniudX9oUAJdFBcKpHaHKc";
export const BENTO_CHAT_SDK_SRC = `${BENTO_CHAT_BASE_URL}/packs/js/sdk.js`;

export type SupportChatUser = {
  identifier: string;
  email?: string;
  name?: string;
};

export type SupportChatOptions = {
  hideBubble?: boolean;
  darkMode?: "light" | "dark" | "auto";
};

export function supportChatSettings(opts: SupportChatOptions = {}) {
  return {
    hideMessageBubble: Boolean(opts.hideBubble),
    position: "right" as const,
    darkMode: opts.darkMode ?? "auto",
  };
}

export function supportChatUser(
  me:
    | {
        userId?: string | null;
        email?: string | null;
        name?: string | null;
      }
    | null
    | undefined,
): SupportChatUser | undefined {
  const identifier = me?.userId?.trim();
  if (!identifier) return undefined;
  const email = me?.email?.trim();
  const name = me?.name?.trim();
  return {
    identifier,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
  };
}

type ChatwootApi = {
  hasLoaded?: boolean;
  toggle: (state?: "open" | "close") => void;
  setUser: (
    identifier: string | number,
    user: { email?: string; name?: string },
  ) => void;
};

type BentoChatSdk = {
  run: (opts: { websiteToken: string; baseUrl: string }) => void;
};

declare global {
  interface Window {
    bento?: unknown;
    chatwootSettings?: Record<string, unknown>;
    bentoChatSDK?: BentoChatSdk;
    chatwootSDK?: BentoChatSdk;
    $chatwoot?: ChatwootApi;
    $bentoChat?: ChatwootApi;
  }
}

let loading: Promise<void> | null = null;

function chatApi(): ChatwootApi | undefined {
  return window.$chatwoot ?? window.$bentoChat;
}

function runSdk() {
  const sdk = window.bentoChatSDK ?? window.chatwootSDK;
  sdk?.run({
    websiteToken: BENTO_CHAT_WEBSITE_TOKEN,
    baseUrl: BENTO_CHAT_BASE_URL,
  });
}

function whenWidgetReady(): Promise<void> {
  if (chatApi()?.hasLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timer);
      if (ok || chatApi()) resolve();
      else reject(new Error("Could not load support chat"));
    };
    const timer = window.setTimeout(() => finish(false), 8000);
    window.addEventListener("chatwoot:ready", () => finish(true), {
      once: true,
    });
  });
}

export function loadSupportChat(opts: SupportChatOptions = {}): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  window.chatwootSettings = {
    ...window.chatwootSettings,
    ...supportChatSettings(opts),
  };
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const start = () => {
      if (typeof window.bento !== "undefined" && !chatApi()) {
        window.addEventListener("bento:ready", runSdk, { once: true });
      } else {
        runSdk();
      }
      void whenWidgetReady().then(resolve, reject);
    };
    if (window.bentoChatSDK || window.chatwootSDK) {
      start();
      return;
    }
    const existing = document.querySelector("script[data-bento-chat]");
    if (existing) {
      existing.addEventListener("load", start, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load support chat")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = BENTO_CHAT_SDK_SRC;
    script.defer = true;
    script.async = true;
    script.dataset.bentoChat = "true";
    script.onload = start;
    script.onerror = () => reject(new Error("Could not load support chat"));
    const first = document.getElementsByTagName("script")[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.appendChild(script);
  });
  void loading.catch(() => {
    loading = null;
  });
  return loading;
}

export async function openSupportChat(user?: SupportChatUser) {
  await loadSupportChat({ hideBubble: true });
  const api = chatApi();
  if (!api) throw new Error("Support chat is not ready");
  if (user && (user.email || user.name)) {
    api.setUser(user.identifier, {
      ...(user.email ? { email: user.email } : {}),
      ...(user.name ? { name: user.name } : {}),
    });
  }
  api.toggle("open");
}
