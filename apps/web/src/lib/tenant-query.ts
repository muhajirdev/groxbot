import { queryClient } from "./orpc";
import { rpcWorkspaceEpoch } from "./rpc-workspace";

/** Drop a late response from the previous office so it cannot overwrite this one. */
export function tenantBoundQueryFn<T>(
  queryKey: readonly unknown[],
  fetchValue: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    const epoch = rpcWorkspaceEpoch();
    const value = await fetchValue();
    if (rpcWorkspaceEpoch() !== epoch) {
      const cached = queryClient.getQueryData<T>(queryKey);
      if (cached !== undefined) return cached;
      throw new Error("workspace switched");
    }
    return value;
  };
}
