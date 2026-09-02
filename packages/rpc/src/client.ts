import type { AppContract } from "@groxbot/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export type GroxbotClient = ContractRouterClient<AppContract>;

export interface CreateGroxbotClientOptions {
  /** Origin of the API, no trailing slash. */
  baseUrl: string;
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  fetch?: typeof globalThis.fetch;
  credentials?: "include" | "omit" | "same-origin";
}

export function createGroxbotClient(
  options: CreateGroxbotClientOptions,
): GroxbotClient {
  const prefix = options.baseUrl.replace(/\/$/, "");
  const link = new RPCLink({
    url: `${prefix}/rpc`,
    headers: options.headers,
    fetch: async (request) => {
      const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
      return fetchFn(request, {
        credentials: options.credentials ?? "include",
      });
    },
  });
  return createORPCClient(link);
}
