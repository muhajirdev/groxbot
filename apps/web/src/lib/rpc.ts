import { createGroxbotClient } from "@groxbot/rpc";
import { apiOrigin } from "./host";
import { rpcWorkspaceHeaders } from "./rpc-workspace";

export const client = createGroxbotClient({
  baseUrl: apiOrigin(),
  headers: rpcWorkspaceHeaders,
});
