import type { ModelProvider, ThinkingEffort } from "@groxbot/contracts";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  catalogGroupLabel,
  DEFAULT_AI_GATEWAY_ID,
  OPENAI_CODEX_PROVIDER,
  PROVIDER_META,
  PROVIDER_ORDER,
  pickerCatalog,
  THINKING_EFFORT_OPTIONS,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { AUTO_TIMEZONE, defaultTimezone, readTimezonePref, writeTimezonePref } from "../lib/prefs";
import { client } from "../lib/rpc";
import { resetRpcWorkspace, setRpcWorkspaceId } from "../lib/rpc-workspace";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "You">;

export function YouScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const modelsQuery = useQuery(orpc.models.get.queryOptions());
  const [workspaceName, setWorkspaceName] = useState(
    meQuery.data?.workspaceName ?? "",
  );
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiCodexAuth, setOpenaiCodexAuth] = useState("");
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [cfAccount, setCfAccount] = useState("");
  const [cfGateway, setCfGateway] = useState<string>(DEFAULT_AI_GATEWAY_ID);
  const [defaultModel, setDefaultModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [effort, setEffort] = useState<ThinkingEffort>("off");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberName, setMemberName] = useState(meQuery.data?.name ?? "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState("");
  const [timezone, setTimezone] = useState(readTimezonePref);
  const [newWorkspace, setNewWorkspace] = useState("");
  const workspacesQuery = useQuery(orpc.workspaces.list.queryOptions());
  const membersQuery = useQuery(orpc.workspaces.members.queryOptions());
  const inviteLinkQuery = useQuery(orpc.workspaces.inviteLink.queryOptions());
  const billingQuery = useQuery(orpc.billing.status.queryOptions());

  useEffect(() => {
    if (meQuery.data?.workspaceName) {
      setWorkspaceName(meQuery.data.workspaceName);
    }
    if (meQuery.data?.name) setMemberName(meQuery.data.name);
  }, [meQuery.data?.workspaceName, meQuery.data?.name]);

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
    if (settings.keys.find((item) => item.provider === CLOUDFLARE_PROVIDER)) {
      const cf = settings.keys.find(
        (item) => item.provider === CLOUDFLARE_PROVIDER,
      );
      if (cf?.accountId) setCfAccount(cf.accountId);
      if (cf?.gatewayId) setCfGateway(cf.gatewayId);
    }
  }, [modelsQuery.data]);

  async function saveWorkspace() {
    const name = workspaceName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await client.workspaces.update({ name });
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not rename workspace"));
    } finally {
      setBusy(false);
    }
  }

  async function saveModels() {
    const settings = modelsQuery.data;
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      const keys: Array<{
        provider: ModelProvider;
        secret?: string;
        accountId?: string;
        gatewayId?: string;
      }> = [];
      if (openrouterKey.trim()) {
        keys.push({ provider: "openrouter", secret: openrouterKey.trim() });
      }
      if (anthropicKey.trim()) {
        keys.push({ provider: "anthropic", secret: anthropicKey.trim() });
      }
      if (openaiKey.trim()) {
        keys.push({ provider: "openai", secret: openaiKey.trim() });
      }
      if (openaiCodexAuth.trim()) {
        keys.push({
          provider: OPENAI_CODEX_PROVIDER,
          secret: openaiCodexAuth.trim(),
        });
      }
      if (cloudflareToken.trim() || cfAccount.trim()) {
        keys.push({
          provider: CLOUDFLARE_PROVIDER,
          secret: cloudflareToken.trim() || undefined,
          accountId: cfAccount.trim() || undefined,
          gatewayId: cfGateway.trim() || DEFAULT_AI_GATEWAY_ID,
        });
      }
      const nextModel =
        defaultModel === CUSTOM_MODEL_SENTINEL
          ? customModel.trim()
          : defaultModel || settings.defaultModelId;
      const next = await client.models.save({
        defaultModel: nextModel,
        customModel:
          defaultModel === CUSTOM_MODEL_SENTINEL
            ? customModel.trim()
            : undefined,
        effort,
        keys: keys.length > 0 ? keys : [{ provider: "openrouter" }],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      setOpenrouterKey("");
      setAnthropicKey("");
      setOpenaiKey("");
      setOpenaiCodexAuth("");
      setCloudflareToken("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not save models"));
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    const name = memberName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await client.account.update({ name });
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      await queryClient.invalidateQueries({
        queryKey: orpc.workspaces.members.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not update your name"));
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email.includes("@")) return;
    setBusy(true);
    setError("");
    try {
      const invite = await client.workspaces.invite({ email });
      setInviteSent(invite.url);
      setInviteEmail("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not send invite"));
    } finally {
      setBusy(false);
    }
  }

  async function createInviteLink() {
    setBusy(true);
    setError("");
    try {
      await client.workspaces.createInviteLink();
      await queryClient.invalidateQueries({
        queryKey: orpc.workspaces.inviteLink.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create an invite link"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteInviteLink() {
    setBusy(true);
    setError("");
    try {
      await client.workspaces.deleteInviteLink();
      await queryClient.invalidateQueries({
        queryKey: orpc.workspaces.inviteLink.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not delete the invite link"));
    } finally {
      setBusy(false);
    }
  }

  async function switchWorkspace(workspaceId: string) {
    setBusy(true);
    setError("");
    try {
      setRpcWorkspaceId(workspaceId);
      await client.workspaces.activate({ workspaceId });
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      navigation.navigate("Roster");
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
      const workspace = await client.workspaces.create({ name });
      setRpcWorkspaceId(workspace.id);
      await client.workspaces.activate({ workspaceId: workspace.id });
      setNewWorkspace("");
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      navigation.navigate("Roster");
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteWorkspace() {
    Alert.alert(
      "Delete this workspace?",
      "Teammates, rooms, and this office go away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void client.workspaces.delete().then(async (result) => {
              if (result.next) {
                setRpcWorkspaceId(result.next.id);
                await client.workspaces.activate({
                  workspaceId: result.next.id,
                });
              } else {
                resetRpcWorkspace();
              }
              queryClient.clear();
              navigation.navigate("Roster");
            });
          },
        },
      ],
    );
  }

  async function signOut() {
    resetRpcWorkspace();
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <Screen scroll>
      <Header title="You" onBack={() => navigation.goBack()} />
      <Text style={styles.body}>{meQuery.data?.email}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field
        label="Your name"
        value={memberName}
        onChangeText={setMemberName}
        autoCapitalize="words"
      />
      <Button label="Save your name" onPress={() => void saveName()} busy={busy} />
      <Field
        label="Workspace"
        value={workspaceName}
        onChangeText={setWorkspaceName}
        autoCapitalize="words"
      />
      <Button
        label="Save workspace name"
        onPress={() => void saveWorkspace()}
        busy={busy}
      />
      <Text style={styles.section}>Workspaces</Text>
      {(workspacesQuery.data ?? []).map((workspace) => (
        <Pressable
          key={workspace.id}
          onPress={() => void switchWorkspace(workspace.id)}
          style={styles.option}
        >
          <Text
            style={
              workspace.id === meQuery.data?.workspaceId ? styles.on : styles.body
            }
          >
            {workspace.name}
          </Text>
        </Pressable>
      ))}
      <Field
        label="New workspace"
        value={newWorkspace}
        onChangeText={setNewWorkspace}
        placeholder="Acme"
      />
      <Button
        label="Create workspace"
        tone="ghost"
        onPress={() => void createWorkspace()}
        busy={busy}
      />
      <Text style={styles.section}>People</Text>
      {(membersQuery.data ?? []).map((member) => (
        <Text key={member.userId} style={styles.meta}>
          {member.name} · {member.email}
          {member.mine ? " · you" : ""}
        </Text>
      ))}
      <Field
        label="Invite by email"
        value={inviteEmail}
        onChangeText={setInviteEmail}
        keyboardType="email-address"
        placeholder="friend@company.com"
      />
      <Button label="Send invite" onPress={() => void sendInvite()} busy={busy} />
      {inviteSent ? (
        <Pressable
          onPress={() => void Clipboard.setStringAsync(inviteSent)}
        >
          <Text style={styles.on}>Invite sent — tap to copy</Text>
        </Pressable>
      ) : null}
      {inviteLinkQuery.data?.url ? (
        <>
          <Text style={styles.meta} selectable>
            {inviteLinkQuery.data.url}
          </Text>
          <Button
            label="Copy invite link"
            tone="ghost"
            onPress={() =>
              void Clipboard.setStringAsync(inviteLinkQuery.data?.url ?? "")
            }
          />
          <Button
            label="Delete invite link"
            tone="ghost"
            onPress={() => void deleteInviteLink()}
            busy={busy}
          />
        </>
      ) : (
        <Button
          label="Create invite link"
          tone="ghost"
          onPress={() => void createInviteLink()}
          busy={busy}
        />
      )}
      <Text style={styles.section}>Usage & Billing</Text>
      <Text style={styles.body}>
        {billingQuery.data
          ? billingQuery.data.enabled
            ? `Plan: ${billingQuery.data.plan}`
            : "Billing is off on this host."
          : "Loading…"}
      </Text>
      <Button
        label="Open billing"
        tone="ghost"
        onPress={() => navigation.navigate("Billing")}
      />
      <Text style={styles.section}>Timezone</Text>
      <Pressable
        onPress={() => {
          writeTimezonePref(AUTO_TIMEZONE);
          setTimezone(AUTO_TIMEZONE);
        }}
        style={styles.option}
      >
        <Text style={timezone === AUTO_TIMEZONE ? styles.on : styles.body}>
          Auto ({defaultTimezone()})
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          writeTimezonePref("UTC");
          setTimezone("UTC");
        }}
        style={styles.option}
      >
        <Text style={timezone === "UTC" ? styles.on : styles.body}>UTC</Text>
      </Pressable>
      <Button
        label="Support"
        tone="ghost"
        onPress={() => void Linking.openURL("https://groxbot.com")}
      />
      <Text style={styles.section}>Default model</Text>
      <Text style={styles.body}>
        {meQuery.data?.needsModel ? "Add a key to talk. " : ""}
        Workspace default is used unless a teammate overrides it.
      </Text>
      {PROVIDER_ORDER.map((provider) => {
        const options = pickerCatalog(
          modelsQuery.data?.catalog ?? [],
          defaultModel || modelsQuery.data?.defaultModelId || "",
        ).filter((item) => item.provider === provider);
        if (options.length === 0) return null;
        return (
          <View key={provider}>
            <Text style={styles.meta}>{catalogGroupLabel(provider)}</Text>
            {options.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setDefaultModel(item.id)}
                style={styles.option}
              >
                <Text
                  style={defaultModel === item.id ? styles.on : styles.body}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      <Pressable
        onPress={() => setDefaultModel(CUSTOM_MODEL_SENTINEL)}
        style={styles.option}
      >
        <Text
          style={
            defaultModel === CUSTOM_MODEL_SENTINEL ? styles.on : styles.body
          }
        >
          Custom model id
        </Text>
      </Pressable>
      {defaultModel === CUSTOM_MODEL_SENTINEL ? (
        <Field
          label="Model id"
          value={customModel}
          onChangeText={setCustomModel}
        />
      ) : null}
      <Text style={styles.section}>Effort</Text>
      <Text style={styles.body}>
        How hard the model thinks. Off skips reasoning.
      </Text>
      {THINKING_EFFORT_OPTIONS.map((item) => (
        <Pressable
          key={item.value}
          onPress={() => setEffort(item.value)}
          style={styles.option}
        >
          <Text style={effort === item.value ? styles.on : styles.body}>
            {item.label}
          </Text>
        </Pressable>
      ))}
      <Text style={styles.section}>Keys</Text>
      {PROVIDER_ORDER.map((provider) => {
        const status = modelsQuery.data?.keys.find(
          (item) => item.provider === provider,
        );
        return (
          <Text key={provider} style={styles.meta}>
            {PROVIDER_META[provider].label}:{" "}
            {status?.configured ? "configured" : "not set"}
          </Text>
        );
      })}
      <Field
        label="OpenRouter key"
        value={openrouterKey}
        onChangeText={setOpenrouterKey}
        secure
      />
      <Field
        label="Anthropic key"
        value={anthropicKey}
        onChangeText={setAnthropicKey}
        secure
      />
      <Field
        label="OpenAI key"
        value={openaiKey}
        onChangeText={setOpenaiKey}
        secure
      />
      <Field
        label="ChatGPT auth.json"
        value={openaiCodexAuth}
        onChangeText={setOpenaiCodexAuth}
        multiline
        placeholder="Paste ~/.codex/auth.json after codex login"
      />
      <Field
        label="Cloudflare account id"
        value={cfAccount}
        onChangeText={setCfAccount}
      />
      <Field
        label="Cloudflare token"
        value={cloudflareToken}
        onChangeText={setCloudflareToken}
        secure
      />
      <Field label="Gateway id" value={cfGateway} onChangeText={setCfGateway} />
      <Button label="Save keys" onPress={() => void saveModels()} busy={busy} />
      <Button
        label="Delete workspace"
        tone="danger"
        onPress={confirmDeleteWorkspace}
      />
      <Button label="Sign out" tone="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15 },
  error: { color: colors.danger },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
  meta: { color: colors.muted },
  option: { paddingVertical: 8 },
  on: { color: colors.accent, fontWeight: "700" },
});
