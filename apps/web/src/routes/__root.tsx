import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import type { authClient } from "../lib/auth";
import { orpc, queryClient } from "../lib/orpc";
import { loadSession, readSession } from "../lib/session";
import { applyTheme, readTheme } from "../lib/theme";

export interface RouterContext {
  queryClient: typeof queryClient;
  orpc: typeof orpc;
  session: Awaited<ReturnType<typeof authClient.getSession>>["data"];
}

function Boot() {
  return (
    <div className="screen">
      <p className="kicker">Groxbot</p>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingMs: 1000,
  pendingComponent: Boot,
  beforeLoad: ({ context }) => {
    const session = readSession(context.queryClient);
    const me = context.queryClient.getQueryData(
      orpc.me.queryOptions().queryKey,
    );
    if (session && me) return { session };
    if (session === null) return { session: null };
    return loadAuthedContext(context.queryClient);
  },
  component: RootComponent,
});

async function loadAuthedContext(client: typeof queryClient) {
  const session = await loadSession(client);
  if (!session) return { session: null };
  try {
    await client.ensureQueryData(orpc.me.queryOptions());
    return { session };
  } catch {
    return { session: null };
  }
}

function RootComponent() {
  useEffect(() => {
    applyTheme(readTheme());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
