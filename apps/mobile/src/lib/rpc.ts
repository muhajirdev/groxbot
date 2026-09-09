import { createGroxbotClient } from "@groxbot/rpc";
import { sessionHeaders } from "./auth";
import { apiOrigin } from "./host";
import { rpcWorkspaceHeaders } from "./rpc-workspace";

export const client = createGroxbotClient({
  baseUrl: apiOrigin(),
  credentials: "omit",
  headers: async () => ({
    ...(await sessionHeaders()),
    ...rpcWorkspaceHeaders(),
  }),
});
