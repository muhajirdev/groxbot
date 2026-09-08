export const CRISP_WEBSITE_ID = "c6116033-f9f2-4980-8ae3-0a4f0fed8852";
export const CRISP_SCRIPT_SRC = "https://client.crisp.chat/l.js";

export type CrispIdentity = {
  email?: string | null;
  name?: string | null;
};

type CrispQueue = { push: (command: unknown) => void };

type CrispHost = {
  $crisp?: CrispQueue;
  CRISP_WEBSITE_ID?: string;
};

type CrispGlobals = {
  window?: CrispHost;
  document?: {
    querySelector: (selector: string) => unknown;
    createElement: (tag: string) => { src: string; async: boolean };
    head: { appendChild: (el: { src: string; async: boolean }) => void };
  };
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function globals(): CrispGlobals {
  return globalThis as CrispGlobals;
}

function host(): CrispHost | null {
  return globals().window ?? null;
}

function queue(): CrispQueue | null {
  return host()?.$crisp ?? null;
}

function hideMessenger() {
  queue()?.push(["do", "chat:hide"]);
}

function cancelHide() {
  if (hideTimer === null) return;
  clearTimeout(hideTimer);
  hideTimer = null;
}

function scheduleHide() {
  cancelHide();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    hideMessenger();
  }, 0);
}

function injectScript() {
  const doc = globals().document;
  if (!doc) return;
  if (doc.querySelector(`script[src="${CRISP_SCRIPT_SRC}"]`)) return;
  const script = doc.createElement("script");
  script.src = CRISP_SCRIPT_SRC;
  script.async = true;
  doc.head.appendChild(script);
}

function bootCrisp(win: CrispHost) {
  win.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
  if (win.$crisp) return;
  win.$crisp = [];
  win.$crisp.push(["safe", true]);
  win.$crisp.push(["do", "chat:hide"]);
  win.$crisp.push(["on", "chat:closed", scheduleHide]);
  win.$crisp.push(["on", "chat:opened", cancelHide]);
  injectScript();
}

export function crispIdentifyCommands(identity?: CrispIdentity): unknown[][] {
  const commands: unknown[][] = [];
  const email = identity?.email?.trim();
  const name = identity?.name?.trim();
  if (email) commands.push(["set", "user:email", [email]]);
  if (name) commands.push(["set", "user:nickname", [name]]);
  return commands;
}

/** Load Crisp once, hide their bubble, then open our support chat. */
export function openCrispChat(identity?: CrispIdentity) {
  const win = host();
  if (!win) return;
  cancelHide();
  bootCrisp(win);
  const crisp = win.$crisp;
  if (!crisp) return;
  for (const command of crispIdentifyCommands(identity)) {
    crisp.push(command);
  }
  crisp.push(["do", "chat:show"]);
  crisp.push(["do", "chat:open"]);
}
