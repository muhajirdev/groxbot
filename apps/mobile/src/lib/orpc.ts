import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient } from "@tanstack/react-query";
import { client } from "./rpc";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const orpc = createTanstackQueryUtils(client);
