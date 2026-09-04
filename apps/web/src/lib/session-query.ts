import { authClient } from "./auth";

export const sessionQueryKey = ["auth", "session"] as const;

/** Same options `loadSession` uses so boot can prefetch during IndexedDB restore. */
export const sessionQueryOptions = {
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data } = await authClient.getSession();
    return data ?? null;
  },
  staleTime: 5 * 60_000,
};
