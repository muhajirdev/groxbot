import type {
  AvatarShape,
  ModelCatalogItem,
  ModelProvider,
} from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  catalogGroupLabel,
  DEFAULT_AI_GATEWAY_ID,
  MOONSHOT_PROVIDER,
  OPENAI_CODEX_PROVIDER,
  OPENROUTER_PROVIDER,
  PROVIDER_META,
  PROVIDER_ORDER,
  pickerCatalog,
  providerForModel,
  SUGGESTED_STARTER_MODEL,
  ZAI_PROVIDER,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Chip } from "../components/Chip";
import { Field } from "../components/Field";
import { AuthGlow, BuddyPile } from "../components/AuthScene";
import { FadeUp, FadeUpStack, Shake } from "../components/Motion";
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

function OnboardPane({
  scene,
  children,
  showPile,
}: {
  scene: string;
  children: ReactNode;
  showPile?: boolean;
}) {
  return (
    <Screen
      scroll
      edges={["top", "left", "right", "bottom"]}
      backdrop={<AuthGlow />}
    >
      <FadeUpStack key={scene}>
        {showPile ? <BuddyPile /> : null}
        {children}
      </FadeUpStack>
    </Screen>
  );
}

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
  const [name, setName] = useState<string>(FIRST_HIRE);
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [shape, setShape] = useState<AvatarShape>("circle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string>();
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [zaiKey, setZaiKey] = useState("");
  const [moonshotKey, setMoonshotKey] = useState("");
  const [openaiCodexAuth, setOpenaiCodexAuth] = useState("");
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
          : selectedProvider === ZAI_PROVIDER
            ? zaiKey
            : selectedProvider === MOONSHOT_PROVIDER
              ? moonshotKey
              : selectedProvider === OPENAI_CODEX_PROVIDER
                ? openaiCodexAuth
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
      if (zaiKey.trim()) {
        keys.push({ provider: ZAI_PROVIDER, secret: zaiKey.trim() });
      }
      if (moonshotKey.trim()) {
        keys.push({ provider: MOONSHOT_PROVIDER, secret: moonshotKey.trim() });
      }
      if (openaiCodexAuth.trim()) {
        keys.push({
          provider: OPENAI_CODEX_PROVIDER,
          secret: openaiCodexAuth.trim(),
        });
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
      <Screen
        edges={["top", "left", "right", "bottom"]}
        backdrop={<AuthGlow />}
      >
        <FadeUp>
          <Text style={styles.kicker}>Warming up the office…</Text>
        </FadeUp>
      </Screen>
    );
  }

  if (phase === "workspace") {
    const pending = invitesQuery.data ?? [];
    return (
      <OnboardPane scene={`workspace-${workspaceStep}`} showPile>
        <Text style={styles.kicker}>Your office</Text>
        {error ? (
          <Shake trigger={error}>
            <Text style={styles.error}>{error}</Text>
          </Shake>
        ) : null}
        {workspaceStep === "choose" ? (
          <View style={styles.block}>
            <Text style={styles.title}>Start a hangout,{"\n"}or join one.</Text>
            <Text style={styles.body}>
              A workspace is the shared office — bots, files, and people under
              one roof.
            </Text>
            <Button
              label="Make a new office"
              tone="brand"
              onPress={() => setWorkspaceStep("create")}
            />
            <Button
              label="I have an invite"
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
            <Text style={styles.title}>What should we call it?</Text>
            <Field
              label="Workspace"
              value={workspaceName}
              onChangeText={setWorkspaceName}
              placeholder="Acme"
              autoCapitalize="words"
            />
            <Button
              label="Open the doors"
              tone="brand"
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
            <Text style={styles.title}>Paste the secret knock.</Text>
            <Field
              label="Invite"
              value={inviteId}
              onChangeText={setInviteId}
              placeholder="inv_…"
            />
            <Button
              label="Join the office"
              tone="brand"
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
      </OnboardPane>
    );
  }

  if (step === 0) {
    return (
      <OnboardPane scene="tour-0" showPile>
        <Text style={styles.kicker}>The idea</Text>
        <Text style={styles.title}>Bots are teammates,{"\n"}not chat boxes.</Text>
        <Text style={styles.body}>
          Each one has a name, a job, and a computer. You talk in one thread —
          like texting a coworker who actually ships.
        </Text>
        <Button label="Show me more" tone="brand" onPress={() => setStep(1)} />
      </OnboardPane>
    );
  }
  if (step === 1) {
    return (
      <OnboardPane scene="tour-1">
        <Text style={styles.kicker}>Their desk</Text>
        <Text style={styles.title}>They already have{"\n"}a computer.</Text>
        <Text style={styles.body}>
          Files land on this bot’s screen. Ignore it until you want to peek.
          Fancy, we know.
        </Text>
        <Button label="Got it" tone="brand" onPress={() => setStep(2)} />
      </OnboardPane>
    );
  }
  if (step === 2) {
    return (
      <OnboardPane scene="tour-2">
        <Text style={styles.kicker}>Your stack</Text>
        <Text style={styles.title}>Where do you live?</Text>
        <Text style={styles.body}>
          Tap the apps you actually open. This only shapes suggestions — nothing
          connects yet.
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
        <Button label="That’s me" tone="brand" onPress={() => setStep(3)} />
      </OnboardPane>
    );
  }
  if (step === 3) {
    return (
      <OnboardPane scene="tour-3">
        <Text style={styles.kicker}>Brains</Text>
        <Text style={styles.title}>Pick a brain.{"\n"}Any brain.</Text>
        <Text style={styles.body}>
          Groxbot includes a hosted gateway. Paste your own key whenever you
          want a different flavor.
        </Text>
        {error ? (
          <Shake trigger={error}>
            <Text style={styles.error}>{error}</Text>
          </Shake>
        ) : null}
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
          ) : selectedProvider === OPENAI_CODEX_PROVIDER ? (
            <Field
              label="ChatGPT auth.json"
              value={openaiCodexAuth}
              onChangeText={setOpenaiCodexAuth}
              multiline
              placeholder={PROVIDER_META[OPENAI_CODEX_PROVIDER].placeholder}
            />
          ) : (
            <Field
              label={`${PROVIDER_META[selectedProvider].label} key`}
              value={keyDraft}
              onChangeText={
                selectedProvider === "openrouter"
                  ? setOpenrouterKey
                  : selectedProvider === "anthropic"
                    ? setAnthropicKey
                    : selectedProvider === ZAI_PROVIDER
                      ? setZaiKey
                      : selectedProvider === MOONSHOT_PROVIDER
                        ? setMoonshotKey
                        : setOpenaiKey
              }
              secure
              placeholder={PROVIDER_META[selectedProvider].placeholder}
            />
          )
        ) : null}
        <Button
          label="This brain works"
          tone="brand"
          onPress={() => void saveModels()}
          busy={busy}
          disabled={!canContinueModels && !settings?.hostedGateway}
        />
      </OnboardPane>
    );
  }

  return (
    <OnboardPane scene="hire">
      <Text style={styles.kicker}>First hire</Text>
      <Text style={styles.title}>Make someone yours.</Text>
      {error ? (
        <Shake trigger={error}>
          <Text style={styles.error}>{error}</Text>
        </Shake>
      ) : null}
      <View style={styles.chips}>
        {SUGGESTED_JOBS.map((job) => (
          <Chip
            key={job}
            label={job}
            selected={name === job}
            onPress={() => {
              setName(job);
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
        label={`Hire ${name || "this teammate"}`}
        tone="brand"
        onPress={() => void create()}
        busy={busy}
      />
    </OnboardPane>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.accent,
    letterSpacing: 0.5,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 36,
  },
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
