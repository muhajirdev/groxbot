import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { BootSplash } from "../components/BootSplash";
import { ToastHost } from "../components/ToastHost";
import type { authClient } from "../lib/auth";
import { applyOfficeColor, readOfficeColor } from "../lib/office-color";
import { workspaceListQueryOptions } from "../lib/office-persist";
import { orpc, queryClient } from "../lib/orpc";
import { loadSession, readSession } from "../lib/session";

export interface RouterContext {
  queryClient: typeof queryClient;
  orpc: typeof orpc;
  session: Awaited<ReturnType<typeof authClient.getSession>>["data"];
}

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: BootSplash,
  beforeLoad: ({ context }) => {
    const session = readSession(context.queryClient);
    const me = context.queryClient.getQueryData(
      orpc.me.queryOptions().queryKey,
    );
    if (session !== undefined && me) {
      if (session) {
        void context.queryClient.ensureQueryData(workspaceListQueryOptions());
      }
      return { session };
    }
    if (session === null) return { session: null };
    return loadAuthedContext(context.queryClient);
  },
  component: RootComponent,
});

async function loadAuthedContext(client: typeof queryClient) {
  try {
    const session = await loadSession(client);
    if (!session) return { session: null };
    void client.ensureQueryData(orpc.me.queryOptions());
    void client.ensureQueryData(workspaceListQueryOptions());
    return { session };
  } catch {
    // API down / offline — treat as signed out so public routes still render.
    return { session: null };
  }
}

function RootComponent() {
  useEffect(() => {
    applyOfficeColor(readOfficeColor());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <ToastHost />
    </QueryClientProvider>
  );
}
