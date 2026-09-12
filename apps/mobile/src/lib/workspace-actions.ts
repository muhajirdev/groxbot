import { Alert } from "react-native";
import { authClient } from "./auth";
import { queryClient } from "./orpc";
import { client } from "./rpc";
import { resetRpcWorkspace } from "./rpc-workspace";
import { refreshOfficeAfterWorkspaceChange } from "./workspace-switch";

export async function activateWorkspace(workspace: {
  id: string;
  name?: string;
  slug?: string;
}): Promise<void> {
  await client.workspaces.activate({ workspaceId: workspace.id });
  await refreshOfficeAfterWorkspaceChange(workspace);
}

export async function createWorkspaceOffice(name: string) {
  const workspace = await client.workspaces.create({ name });
  await client.workspaces.activate({ workspaceId: workspace.id });
  await refreshOfficeAfterWorkspaceChange({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  });
  return workspace;
}

export async function signOutSession(): Promise<void> {
  resetRpcWorkspace();
  await authClient.signOut();
  queryClient.clear();
}

export function confirmSignOut(): void {
  Alert.alert("Sign out?", "You'll need to sign in again to open this office.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Sign out",
      style: "destructive",
      onPress: () => void signOutSession(),
    },
  ]);
}
