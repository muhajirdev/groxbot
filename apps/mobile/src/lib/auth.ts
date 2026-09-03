import { expoClient } from "@better-auth/expo/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { apiOrigin } from "./host";

export const authClient = createAuthClient({
  baseURL: apiOrigin(),
  plugins: [
    magicLinkClient(),
    expoClient({
      scheme: "groxbot",
      storagePrefix: "groxbot",
      storage: SecureStore,
    }),
  ],
});

export async function sessionCookie(): Promise<string> {
  if (typeof authClient.getCookie !== "function") return "";
  try {
    return (await authClient.getCookie()) ?? "";
  } catch {
    return "";
  }
}

export async function sessionHeaders(): Promise<Record<string, string>> {
  const cookie = await sessionCookie();
  return cookie ? { Cookie: cookie } : {};
}
