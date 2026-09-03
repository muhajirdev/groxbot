import type { ModelProvider } from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  DEFAULT_AI_GATEWAY_ID,
  PROVIDER_META,
  PROVIDER_ORDER,
} from "@groxbot/contracts";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
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
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [cfAccount, setCfAccount] = useState("");
  const [cfGateway, setCfGateway] = useState<string>(DEFAULT_AI_GATEWAY_ID);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (meQuery.data?.workspaceName) {
      setWorkspaceName(meQuery.data.workspaceName);
    }
  }, [meQuery.data?.workspaceName]);

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
      if (cloudflareToken.trim() || cfAccount.trim()) {
        keys.push({
          provider: CLOUDFLARE_PROVIDER,
          secret: cloudflareToken.trim() || undefined,
          accountId: cfAccount.trim() || undefined,
          gatewayId: cfGateway.trim() || DEFAULT_AI_GATEWAY_ID,
        });
      }
      const next = await client.models.save({
        defaultModel: settings.defaultModelId,
        keys: keys.length > 0 ? keys : [{ provider: "openrouter" }],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      setOpenrouterKey("");
      setAnthropicKey("");
      setOpenaiKey("");
      setCloudflareToken("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not save models"));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <Screen scroll>
      <Header title="You" onBack={() => navigation.goBack()} />
      <Text style={styles.body}>{meQuery.data?.email}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Field
        label="Workspace"
        value={workspaceName}
        onChangeText={setWorkspaceName}
        autoCapitalize="words"
      />
      <Button
        label="Save name"
        onPress={() => void saveWorkspace()}
        busy={busy}
      />
      <Text style={styles.section}>Models</Text>
      <Text style={styles.body}>
        Default:{" "}
        {meQuery.data?.defaultModelLabel ||
          modelsQuery.data?.defaultModel ||
          "not set"}
        {meQuery.data?.needsModel ? " — add a key to talk" : ""}
      </Text>
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
      {modelsQuery.data?.usage ? (
        <View>
          <Text style={styles.section}>Hosted usage</Text>
          <Text style={styles.meta}>
            {modelsQuery.data.usage.totalTokens} tokens ·{" "}
            {modelsQuery.data.usage.requests} requests
          </Text>
        </View>
      ) : null}
      <Button label="Sign out" tone="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15 },
  error: { color: colors.danger },
  section: { color: colors.text, fontWeight: "700", marginTop: 12 },
  meta: { color: colors.muted },
});
