import {
  CUSTOM_MODEL_SENTINEL,
  canSaveDefaultModelChoice,
  catalogGroupLabel,
  pickerCatalog,
  PROVIDER_ORDER,
  type ThinkingEffort,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { FadeUp } from "../components/Motion";
import { Screen } from "../components/Screen";
import { SettingsGroup, SettingsRow } from "../components/SettingsRow";
import { Sheet, SheetRow } from "../components/Sheet";
import { userFacingError } from "../lib/errors";
import { webOrigin } from "../lib/host";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import {
  activateWorkspace,
  confirmSignOut,
  createWorkspaceOffice,
} from "../lib/workspace-actions";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "You">;

function planLabel(plan?: string): string {
  if (plan === "believers") return "Believers";
  if (plan === "plus") return "Pro Plus";
  if (plan === "pro") return "Pro";
  if (plan === "none" || !plan) return "None";
  return plan;
}

export function YouScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const modelsQuery = useQuery(orpc.models.get.queryOptions());
  const workspacesQuery = useQuery(orpc.workspaces.list.queryOptions());
  const billingQuery = useQuery(orpc.billing.status.queryOptions());
  const [defaultModel, setDefaultModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [effort, setEffort] = useState<ThinkingEffort>("off");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState("");

  useEffect(() => {
    const settings = modelsQuery.data;
    if (!settings) return;
    const listed = settings.catalog.some(
      (item) => item.id === settings.defaultModelId,
    );
    setDefaultModel(
      listed || !settings.defaultModelId
        ? settings.defaultModelId
        : CUSTOM_MODEL_SENTINEL,
    );
    setCustomModel(listed ? "" : settings.defaultModelId);
    setEffort(settings.effort);
  }, [modelsQuery.data]);

  const catalog = pickerCatalog(
    modelsQuery.data?.catalog ?? [],
    defaultModel || modelsQuery.data?.defaultModelId || "",
  );
  const modelLabel =
    defaultModel === CUSTOM_MODEL_SENTINEL
      ? customModel.trim() || "Custom"
      : catalog.find((item) => item.id === defaultModel)?.label || "Choose";

  async function persistChoice(nextModel: string, nextCustom: string) {
    const settings = modelsQuery.data;
    if (!settings || !canSaveDefaultModelChoice(nextModel, nextCustom)) return;
    setBusy(true);
    setError("");
    try {
      const next = await client.models.save({
        defaultModel: nextModel,
        customModel:
          nextModel === CUSTOM_MODEL_SENTINEL ? nextCustom.trim() : undefined,
        effort,
        keys: [],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not save models"));
    } finally {
      setBusy(false);
    }
  }

  async function switchWorkspace(workspaceId: string) {
    setBusy(true);
    setError("");
    try {
      const listed = (workspacesQuery.data ?? []).find(
        (row) => row.id === workspaceId,
      );
      await activateWorkspace({
        id: workspaceId,
        name: listed?.name,
        slug: listed?.slug,
      });
      setWorkspaceOpen(false);
      navigation.navigate("Office");
    } catch (caught) {
      setError(userFacingError(caught, "Could not switch workspace"));
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    const name = newWorkspace.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await createWorkspaceOffice(name);
      setNewWorkspace("");
      setWorkspaceOpen(false);
      navigation.navigate("Office");
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll safe={false}>
      <FadeUp>
        <View style={styles.ident}>
          <Text style={styles.name}>{meQuery.data?.name || "You"}</Text>
          <Text style={styles.email}>{meQuery.data?.email}</Text>
        </View>
      </FadeUp>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SettingsGroup>
        <SettingsRow
          label="Workspace"
          value={meQuery.data?.workspaceName || "Office"}
          onPress={() => setWorkspaceOpen(true)}
        />
        <SettingsRow
          label="Model"
          value={modelLabel}
          onPress={() => setModelOpen(true)}
        />
        <SettingsRow
          label="Plan"
          value={
            billingQuery.data?.enabled
              ? planLabel(billingQuery.data.plan)
              : "Self-host"
          }
          onPress={() => navigation.navigate("Billing")}
          last
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          label="Open web office"
          onPress={() => void Linking.openURL(webOrigin())}
          last
        />
      </SettingsGroup>
      <Text style={styles.foot}>
        Invites, keys, and plan changes live in the web office.
      </Text>

      <Button label="Sign out" tone="ghost" onPress={confirmSignOut} />

      <Sheet
        open={workspaceOpen}
        title="Workspaces"
        onClose={() => setWorkspaceOpen(false)}
        scroll
      >
        {(workspacesQuery.data ?? []).map((workspace) => (
          <SheetRow
            key={workspace.id}
            label={workspace.name}
            selected={workspace.id === meQuery.data?.workspaceId}
            onPress={() => void switchWorkspace(workspace.id)}
          />
        ))}
        <View style={styles.sheetForm}>
          <Field
            placeholder="New workspace"
            value={newWorkspace}
            onChangeText={setNewWorkspace}
            autoCapitalize="words"
          />
          <Button
            label="Create"
            onPress={() => void createWorkspace()}
            busy={busy}
            disabled={!newWorkspace.trim()}
          />
        </View>
      </Sheet>

      <Sheet
        open={modelOpen}
        title="Default model"
        onClose={() => setModelOpen(false)}
        scroll
      >
        {PROVIDER_ORDER.map((provider) => {
          const options = catalog.filter((item) => item.provider === provider);
          if (options.length === 0) return null;
          return (
            <View key={provider}>
              <Text style={styles.sheetGroup}>
                {catalogGroupLabel(provider)}
              </Text>
              {options.map((item) => (
                <SheetRow
                  key={item.id}
                  label={item.label}
                  selected={defaultModel === item.id}
                  onPress={() => {
                    setDefaultModel(item.id);
                    setModelOpen(false);
                    void persistChoice(item.id, customModel);
                  }}
                />
              ))}
            </View>
          );
        })}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ident: { paddingHorizontal: 4, paddingBottom: 18, gap: 4 },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  email: { color: colors.muted, fontSize: 15 },
  error: { color: colors.danger, marginBottom: 8 },
  foot: {
    color: colors.faint,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginTop: 10,
    marginBottom: 20,
  },
  sheetForm: { padding: 16, gap: 12 },
  sheetGroup: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 2,
  },
});
