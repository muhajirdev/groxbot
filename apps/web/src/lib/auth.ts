import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { apiOrigin } from "./host";

export const authClient = createAuthClient({
  baseURL: apiOrigin(),
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient(), emailOTPClient()],
});
