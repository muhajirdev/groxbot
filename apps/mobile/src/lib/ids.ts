/** Hermes in Expo Go has no `crypto` global. Message ids are not a secret. */
function fallbackRandomUUID(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newId(): string {
  const web = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof web?.randomUUID === "function") return web.randomUUID();
  return fallbackRandomUUID();
}

export function installCryptoPolyfill(): void {
  const target = globalThis as typeof globalThis & {
    crypto?: { randomUUID?: () => string };
  };
  if (typeof target.crypto?.randomUUID === "function") return;
  Object.defineProperty(target, "crypto", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: {
      ...(target.crypto ?? {}),
      randomUUID: fallbackRandomUUID,
    },
  });
}

installCryptoPolyfill();
