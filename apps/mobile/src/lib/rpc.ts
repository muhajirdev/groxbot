import { createGroxbotClient } from "@groxbot/rpc";
import { sessionHeaders } from "./auth";
import { apiOrigin } from "./host";

export const client = createGroxbotClient({
  baseUrl: apiOrigin(),
  credentials: "omit",
  headers: () => sessionHeaders(),
});
