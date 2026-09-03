import type {
  AvatarShape,
  ModelCatalogItem,
  ModelProvider,
} from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  catalogGroupLabel,
  DEFAULT_AI_GATEWAY_ID,
  OPENROUTER_PROVIDER,
  PROVIDER_META,
  PROVIDER_ORDER,
  pickerCatalog,
  providerForModel,
  SUGGESTED_STARTER_MODEL,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import {
  clearRememberedInvite,
  invitationIdFromInput,
  readRememberedInvite,
  rememberInvite,
} from "../lib/invite";
import {
  AVATAR_COLORS,
  AVATAR_SHAPES,
  FIRST_HIRE,
  SUGGESTED_JOBS,
} from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { firstLiveBot } from "../lib/sidebar";
import { colors, radius } from "../theme";

const TOOLS = [
  "Gmail",
  "Slack",
  "GitHub",
  "LinkedIn",
  "Notion",
  "Drive",
  "Calendar",
  "Linear",
] as const;

export function OnboardingScreen({
  invite,
  onDone,
}: {
  invite?: string;
  onDone: (botId?: string) => void;
}) {
  const queryClient = useQueryClient();
  const meQuery = useQuery(orpc.me.queryOptions());
  const invitesQuery = useQuery({
    ...orpc.workspaces.invitations.queryOptions(),
    enabled: Boolean(meQuery.data?.needsWorkspace),
  });
  const modelsQuery = useQuery({
    ...orpc.models.get.queryOptions(),
    enabled: Boolean(meQuery.data && !meQuery.data.needsWorkspace),
  });
  const settings = modelsQuery.data;

  const [phase, setPhase] = useState<"workspace" | "tour">();
  const [workspaceStep, setWorkspaceStep] = useState<
    "choose" | "create" | "join"
  >("choose");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteId, setInviteId] = useState(
    invitationIdFromInput(invite ?? readRememberedInvite()),
  );
  const [step, setStep] = useState(0);
  const [tools, setTools] = useState<string[]>([]);
  const [name, setName] = useState<string>(FIRST_HIRE.title);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>(
    FIRST_HIRE.description,
  );
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [shape, setShape] = useState<AvatarShape>("circle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string>();
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [cloudflareToken, setCloudflareToken] = useState("");
  const [cfAccount, setCfAccount] = useState("");
  const [cfGateway, setCfGateway] = useState<string>(DEFAULT_AI_GATEWAY_ID);

  useEffect(() => {
    if (!meQuery.data) return;
    setPhase(meQuery.data.needsWorkspace ? "workspace" : "tour");
  }, [meQuery.data]);

  const selectedModel =
    defaultModel ?? settings?.defaultModelId ?? SUGGESTED_STARTER_MODEL;
  const selectedMeta = settings?.catalog.find(
    (item) => item.id === selectedModel,
  );
  const selectedProvider =
    selectedMeta?.provider ??
    providerForModel(selectedModel) ??
    OPENROUTER_PROVIDER;
  const grouped = useMemo(() => {
    const map = new Map<ModelProvider, ModelCatalogItem[]>();
    for (const item of pickerCatalog(settings?.catalog ?? [], selectedModel)) {
      const list = map.get(item.provider) ?? [];
      list.push(item);
      map.set(item.provider, list);
    }
    return map;
  }, [settings?.catalog, selectedModel]);
  const modelsReady = Boolean(
    meQuery.data && (!meQuery.data.needsModel || selectedMeta?.available),
  );
  const keyDraft =
    selectedProvider === "openrouter"
      ? openrouterKey
      : selectedProvider === "anthropic"
        ? anthropicKey
        : selectedProvider === "openai"
          ? openaiKey
          : cloudflareToken;
  const providerStatus = settings?.keys.find(
    (item) => item.provider === selectedProvider,
  );
  const canContinueModels =
    modelsReady ||
    Boolean(keyDraft.trim()) ||
    Boolean(providerStatus?.configured && selectedMeta?.available);

  async function createWorkspace() {
    const next = workspaceName.trim() || "Office";
    setBusy(true);
    setError("");
    try {
      await client.workspaces.create({ name: next });
      clearRememberedInvite();
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      setBusy(false);
      setPhase("tour");
      setStep(0);
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
      setBusy(false);
    }
  }

  async function joinOffice() {
    const raw = invitationIdFromInput(inviteId);
    if (!raw) {
      setError("Paste an invite to join.");
      return;
    }
    setBusy(true);
    setError("");
    rememberInvite(raw);
    try {
      await client.workspaces.join({ invitationId: raw });
      clearRememberedInvite();
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      const bots = await client.bots.list();
      const first = firstLiveBot(bots);
      if (first) {
        onDone(first.id);
        return;
      }
      setBusy(false);
      setPhase("tour");
      setStep(0);
    } catch (caught) {
      setError(userFacingError(caught, "Could not join workspace"));
      setBusy(false);
    }
  }

  async function saveModels() {
    if (!settings) return;
    if (modelsReady) {
      setStep(4);
      return;
    }
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
      if (
        selectedProvider === CLOUDFLARE_PROVIDER ||
        cloudflareToken.trim() ||
        cfAccount.trim()
      ) {
        keys.push({
          provider: CLOUDFLARE_PROVIDER,
          secret: cloudflareToken.trim() || undefined,
          accountId: cfAccount.trim() || undefined,
          gatewayId: cfGateway.trim() || DEFAULT_AI_GATEWAY_ID,
        });
      }
      if (keys.length === 0 && !providerStatus?.configured) {
        if (settings.hostedGateway) {
          setBusy(false);
          setStep(4);
          return;
        }
        setError(
          `Paste a ${PROVIDER_META[selectedProvider].label} key to continue.`,
        );
        setBusy(false);
        return;
      }
      const next = await client.models.save({
        defaultModel: selectedModel,
        keys: keys.length > 0 ? keys : [{ provider: selectedProvider }],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      setBusy(false);
      setStep(4);
    } catch (caught) {
      setError(userFacingError(caught, "Could not save models"));
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const bot = await client.bots.create({
        name,
        title,
        description,
        instructions: description,
        avatarColor: color,
        avatarShape: shape,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.bots.list.key() });
      onDone(bot.id);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create teammate",
      );
      setBusy(false);
    }
  }

  if (!phase) {
    return (
      <Screen>
        <Text style={styles.kicker}>Groxbot</Text>
      </Screen>
    );
  }

  if (phase === "workspace") {
    const pending = invitesQuery.data ?? [];
    return (
      <Screen scroll>
        <Text style={styles.kicker}>Your workspace</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {workspaceStep === "choose" ? (
          <View style={styles.block}>
            <Text style={styles.title}>Create or join?</Text>
            <Text style={styles.body}>
              A workspace is the office. Bots, files, and people share it.
            </Text>
            <Button
              label="Create a workspace"
              onPress={() => setWorkspaceStep("create")}
            />
            <Button
              label="Join with an invite"
              tone="ghost"
              onPress={() => setWorkspaceStep("join")}
            />
            {pending.map((row) => (
              <Button
                key={row.id}
                tone="ghost"
                label={`Join ${row.organizationName}`}
                onPress={() => {
                  setInviteId(row.id);
                  setWorkspaceStep("join");
                }}
              />
            ))}
          </View>
        ) : null}
        {workspaceStep === "create" ? (
          <View style={styles.block}>
            <Text style={styles.title}>Name the office</Text>
            <Field
              label="Workspace"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="Acme"
              autoCapitalize="words"
            />
            <Button
              label="Create"
              onPress={() => void createWorkspace()}
              busy={busy}
            />
            <Button
              label="Back"
              tone="ghost"
              onPress={() => setWorkspaceStep("choose")}
            />
          </View>
        ) : null}
        {workspaceStep === "join" ? (
          <View style={styles.block}>
            <Text style={styles.title}>Paste an invite</Text>
            <Field
              label="Invite"
              value={inviteId}
              onChangeText={setInviteId}
              placeholder="inv_…"
            />
            <Button
              label="Join"
              onPress={() => void joinOffice()}
              busy={busy}
            />
            <Button
              label="Back"
              tone="ghost"
              onPress={() => setWorkspaceStep("choose")}
            />
          </View>
        ) : null}
      </Screen>
    );
  }

  if (step === 0) {
    return (
      <Screen scroll>
        <Text style={styles.kicker}>Tour</Text>
        <Text style={styles.title}>Bots are teammates.</Text>
        <Text style={styles.body}>
          Each one has a name, a job, and a computer. You talk in one thread.
        </Text>
        <Button label="Next" onPress={() => setStep(1)} />
      </Screen>
    );
  }
  if (step === 1) {
    return (
      <Screen scroll>
        <Text style={styles.kicker}>Tour</Text>
        <Text style={styles.title}>The computer is already theirs.</Text>
        <Text style={styles.body}>
          Files land on this bot’s screen. You can ignore it until you need it.
        </Text>
        <Button label="Next" onPress={() => setStep(2)} />
      </Screen>
    );
  }
  if (step === 2) {
    return (
      <Screen scroll>
        <Text style={styles.kicker}>Tools</Text>
        <Text style={styles.title}>Which tools do you use?</Text>
        <Text style={styles.body}>
          This only shapes suggestions. Nothing connects yet.
        </Text>
        <View style={styles.chips}>
          {TOOLS.map((tool) => (
            <Chip
              key={tool}
              label={tool}
              selected={tools.includes(tool)}
              onPress={() =>
                setTools((prev) =>
                  prev.includes(tool)
                    ? prev.filter((item) => item !== tool)
                    : [...prev, tool],
                )
              }
            />
          ))}
        </View>
        <Button label="Continue" onPress={() => setStep(3)} />
      </Screen>
    );
  }
  if (step === 3) {
    return (
      <Screen scroll>
        <Text style={styles.kicker}>Models</Text>
        <Text style={styles.title}>Pick a brain</Text>
        <Text style={styles.body}>
          Groxbot includes a hosted gateway. Paste your own key anytime.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {PROVIDER_ORDER.filter((provider) => grouped.has(provider)).map(
          (provider) => (
            <View key={provider} style={styles.block}>
              <Text style={styles.group}>{catalogGroupLabel(provider)}</Text>
              {(grouped.get(provider) ?? []).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setDefaultModel(item.id)}
                  style={[
                    styles.option,
                    selectedModel === item.id ? styles.optionOn : null,
                  ]}
                >
                  <Text style={styles.optionLabel}>
                    {item.label}
                    {item.available ? "" : " — needs key"}
                  </Text>
                </Pressable>
              ))}
            </View>
          ),
        )}
        {!modelsReady ? (
          selectedProvider === CLOUDFLARE_PROVIDER ? (
            <>
              <Field
                label="Cloudflare account id"
                value={cfAccount}
                onChangeText={setCfAccount}
              />
              <Field
                label="API token"
                value={cloudflareToken}
                onChangeText={setCloudflareToken}
                secure
              />
              <Field
                label="Gateway id"
                value={cfGateway}
                onChangeText={setCfGateway}
              />
            </>
          ) : (
            <Field
              label={`${PROVIDER_META[selectedProvider].label} key`}
              value={keyDraft}
              onChangeText={
                selectedProvider === "openrouter"
                  ? setOpenrouterKey
                  : selectedProvider === "anthropic"
                    ? setAnthropicKey
                    : setOpenaiKey
              }
              secure
              placeholder={PROVIDER_META[selectedProvider].placeholder}
            />
          )
        ) : null}
        <Button
          label="Continue"
          onPress={() => void saveModels()}
          busy={busy}
          disabled={!canContinueModels && !settings?.hostedGateway}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.kicker}>Hire</Text>
      <Text style={styles.title}>Meet a teammate</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.chips}>
        {SUGGESTED_JOBS.map((job) => (
          <Chip
            key={job.title}
            label={job.title}
            selected={name === job.title}
            onPress={() => {
              setName(job.title);
              setTitle(job.title);
              setDescription(job.description);
            }}
          />
        ))}
      </View>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <Field
        label="Job"
        value={title}
        onChangeText={setTitle}
        autoCapitalize="sentences"
      />
      <Field
        label="How it should work"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <View style={styles.avatarRow}>
        <Avatar name={name} color={color} shape={shape} size={56} />
        <View style={styles.chips}>
          {AVATAR_COLORS.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              style={[
                styles.swatch,
                { backgroundColor: swatch },
                color === swatch ? styles.swatchOn : null,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.chips}>
        {AVATAR_SHAPES.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={shape === item}
            onPress={() => setShape(item)}
          />
        ))}
      </View>
      <Button
        label={`Hire ${name || "this bot"}`}
        onPress={() => void create()}
        busy={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 11,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  error: { color: colors.danger },
  block: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { color: colors.muted, fontWeight: "700" },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.accent },
  optionLabel: { color: colors.text },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchOn: { borderWidth: 2, borderColor: colors.white },
});
