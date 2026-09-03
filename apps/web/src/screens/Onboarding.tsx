import type {
  AvatarShape,
  ModelCatalogItem,
  ModelProvider,
} from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  DEFAULT_AI_GATEWAY_ID,
  OPENROUTER_PROVIDER,
  PROVIDER_META,
  PROVIDER_ORDER,
  catalogGroupLabel,
  pickerCatalog,
  providerForModel,
  SUGGESTED_STARTER_MODEL,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AvatarMark, ShapePicks } from "../components/Avatar";
import {
  GateAnywhere,
  GateSplit,
  GateSteps,
  GateWelcome,
} from "../components/Gate";
import { OfficeFeed } from "../components/OfficeFeed";
import { authClient } from "../lib/auth";
import { clearThreadStore } from "../lib/collections";
import { userFacingError } from "../lib/errors";
import { runGateTransition } from "../lib/gate-transition";
import {
  clearRememberedInvite,
  readRememberedInvite,
  rememberInvite,
} from "../lib/invite";
import {
  AVATAR_COLORS,
  AVATAR_SHAPES,
  FIRST_HIRE,
  SUGGESTED_JOBS,
} from "../lib/jobs";
import { OFFICE_TO, officeParams } from "../lib/office-route";
import { orpc } from "../lib/orpc";
import { composioLogoUrl } from "../lib/plugins";
import { client } from "../lib/rpc";
import { setRpcWorkspaceId } from "../lib/rpc-workspace";
import { cacheCreatedBot, firstLiveBot } from "../lib/session";
import { writeCachedWorkspace } from "../lib/workspace-switcher";
import { Button, Chip, Field, Input, Select, Textarea } from "../ui";

const TOOLS = [
  { name: "Gmail", logo: composioLogoUrl("gmail") },
  { name: "Slack", logo: composioLogoUrl("slack") },
  { name: "GitHub", logo: composioLogoUrl("github") },
  { name: "LinkedIn", logo: composioLogoUrl("linkedin") },
  { name: "Notion", logo: composioLogoUrl("notion") },
  { name: "Drive", logo: composioLogoUrl("googledrive") },
  { name: "Calendar", logo: composioLogoUrl("googlecalendar") },
  { name: "Linear", logo: composioLogoUrl("linear") },
] as const;

const MODEL_MARKS = [
  { name: "Claude", src: "/models/claude.svg", tone: "light" },
  { name: "GPT", src: "/models/openai.svg", tone: "light" },
  { name: "Grok", src: "/models/grok.svg", tone: "light" },
  { name: "Kimi", src: "/models/kimi.svg", tone: "dark" },
  { name: "DeepSeek", src: "/models/deepseek.svg", tone: "light" },
] as const;

export function Onboarding(props: { invite?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
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
  const [inviteId, setInviteId] = useState("");
  const [step, setStep] = useState(0);
  const [tools, setTools] = useState<string[]>([]);
  const [name, setName] = useState(FIRST_HIRE.title);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(FIRST_HIRE.description);
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

  const modelGroups = useMemo(
    () =>
      PROVIDER_ORDER.filter((provider) => grouped.has(provider)).map(
        (provider) => ({
          label: catalogGroupLabel(provider),
          options: (grouped.get(provider) ?? []).map((item) => ({
            value: item.id,
            label: `${item.label}${item.available ? "" : " — needs key"}`,
          })),
        }),
      ),
    [grouped],
  );

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

  function go(next: number) {
    setError("");
    runGateTransition(() => setStep(next));
  }

  function pickJob(job: (typeof SUGGESTED_JOBS)[number]) {
    runGateTransition(() => {
      setName(job.title);
      setTitle("");
      setDescription(job.description);
      setStep(5);
    });
  }

  async function signOut() {
    await authClient.signOut();
    clearThreadStore();
    queryClient.clear();
    await router.invalidate();
    await navigate({ to: "/" });
  }

  function frame(children: ReactNode) {
    return (
      <GateSplit
        proof={
          <OfficeFeed
            youName={meQuery.data?.name}
            youImage={meQuery.data?.image}
          />
        }
        onSignOut={() => void signOut()}
      >
        {children}
      </GateSplit>
    );
  }

  useEffect(() => {
    if (!meQuery.data || phase) return;
    const invite = props.invite?.trim() || readRememberedInvite();
    if (invite) {
      rememberInvite(invite);
      setInviteId(invite);
      setWorkspaceStep("join");
      setPhase("workspace");
      return;
    }
    if (!meQuery.data.needsWorkspace) {
      setPhase("tour");
      return;
    }
    setPhase("workspace");
  }, [meQuery.data, phase, props.invite]);

  function goWorkspace(next: "choose" | "create" | "join") {
    setError("");
    runGateTransition(() => setWorkspaceStep(next));
  }

  async function createOffice() {
    const name = workspaceName.trim();
    if (!name) {
      setError("Name the workspace to continue.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await client.workspaces.create({ name });
      clearRememberedInvite();
      const me = await queryClient.fetchQuery(orpc.me.queryOptions());
      writeCachedWorkspace({
        id: me.workspaceId,
        name: me.workspaceName ?? name,
        slug: me.workspaceSlug,
      });
      if (me.workspaceId) setRpcWorkspaceId(me.workspaceId);
      setBusy(false);
      runGateTransition(() => {
        setPhase("tour");
        setStep(0);
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
      setBusy(false);
    }
  }

  async function joinOffice() {
    const raw = inviteId.trim();
    if (!raw) {
      setError("Paste an invite to join.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await client.workspaces.join({ invitationId: raw });
      clearRememberedInvite();
      const me = await queryClient.fetchQuery(orpc.me.queryOptions());
      if (me.workspaceId) setRpcWorkspaceId(me.workspaceId);
      writeCachedWorkspace({
        id: me.workspaceId,
        name: me.workspaceName,
        slug: me.workspaceSlug,
      });
      const bots = await client.bots.list();
      const first = firstLiveBot(bots);
      if (first) {
        try {
          await cacheCreatedBot(first);
        } catch {
          // Office loader will fetch the roster.
        }
        if (!me.workspaceSlug) {
          setBusy(false);
          return;
        }
        await navigate({
          to: OFFICE_TO,
          params: officeParams(me.workspaceSlug, first.id),
          viewTransition: true,
        });
        return;
      }
      setBusy(false);
      runGateTransition(() => {
        setPhase("tour");
        setStep(0);
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not join workspace"));
      setBusy(false);
    }
  }

  async function saveModels() {
    if (!settings) return;
    if (modelsReady) {
      go(4);
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
          go(4);
          return;
        }
        setError(
          `Paste a ${PROVIDER_META[selectedProvider].label} key to continue.`,
        );
        return;
      }
      const next = await client.models.save({
        defaultModel: selectedModel,
        keys: keys.length > 0 ? keys : [{ provider: selectedProvider }],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      const runnable = next.catalog.find((item) => item.id === selectedModel);
      if (runnable && !runnable.available) {
        setError(
          `${runnable.label} still needs a ${PROVIDER_META[runnable.provider].label} key.`,
        );
        return;
      }
      setOpenrouterKey("");
      setAnthropicKey("");
      setOpenaiKey("");
      setCloudflareToken("");
      setBusy(false);
      go(4);
    } catch (caught) {
      setError(userFacingError(caught, "Could not save models"));
    } finally {
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
      localStorage.setItem("groxbot.onboarded", "1");
      await cacheCreatedBot(bot);
      const me = await queryClient.fetchQuery(orpc.me.queryOptions());
      if (!me.workspaceSlug) {
        throw new Error("Could not open the office");
      }
      await navigate({
        to: OFFICE_TO,
        params: officeParams(me.workspaceSlug, bot.id),
        viewTransition: true,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create teammate",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!phase) {
    return frame(<p className="gate-greeting">Groxbot</p>);
  }

  if (phase === "workspace") {
    const pending = invitesQuery.data ?? [];
    return frame(
      <>
        {workspaceStep === "choose" ? (
          <GateWelcome key="choose">
            <Button type="button" onClick={() => goWorkspace("create")}>
              Create a workspace
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => goWorkspace("join")}
            >
              Join with an invite →
            </Button>
          </GateWelcome>
        ) : null}
        {workspaceStep === "create" ? (
          <div className="gate-stage" key="create">
            <p className="kicker">Your workspace</p>
            <h1>Name the workspace.</h1>
            <p className="lede">
              This is the office bots and people share. You can invite others
              from Settings.
            </p>
            <Field label="Workspace name">
              <Input
                value={workspaceName}
                placeholder="Acme"
                autoComplete="organization"
                onValueChange={setWorkspaceName}
              />
            </Field>
            {error ? <p className="error">{error}</p> : null}
            <div className="gate-nav">
              <Button
                variant="ghost"
                type="button"
                onClick={() => goWorkspace("choose")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !workspaceName.trim()}
                onClick={() => void createOffice()}
              >
                {busy ? "Creating…" : "Continue"}
              </Button>
            </div>
          </div>
        ) : null}
        {workspaceStep === "join" ? (
          <div className="gate-stage" key="join">
            <p className="kicker">Your workspace</p>
            <h1>Join a workspace.</h1>
            <p className="lede">
              Paste the invite link, or pick one waiting for{" "}
              {meQuery.data?.email}.
            </p>
            {pending.length > 0 ? (
              <div className="gate-tools">
                {pending.map((item) => (
                  <Chip
                    key={item.id}
                    selected={inviteId === item.id}
                    onClick={() => {
                      setError("");
                      setInviteId(item.id);
                    }}
                  >
                    {item.organizationName}
                  </Chip>
                ))}
              </div>
            ) : null}
            <Field label="Invite">
              <Input
                value={inviteId}
                placeholder="Paste invite link or id"
                autoComplete="off"
                spellCheck={false}
                onValueChange={setInviteId}
              />
            </Field>
            {error ? <p className="error">{error}</p> : null}
            <div className="gate-nav">
              <Button
                variant="ghost"
                type="button"
                onClick={() => goWorkspace("choose")}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !inviteId.trim()}
                onClick={() => void joinOffice()}
              >
                {busy ? "Joining…" : "Join"}
              </Button>
            </div>
          </div>
        ) : null}
      </>,
    );
  }

  return frame(
    <>
      {step !== 0 ? (
        <>
          <p className="kicker">Hire your first Bot</p>
          <GateSteps current={step} total={6} />
        </>
      ) : null}
      {step === 0 ? (
        <GateWelcome key="tour">
          <Button type="button" onClick={() => go(1)}>
            Continue
          </Button>
        </GateWelcome>
      ) : null}
      {step === 1 ? (
        <div className="gate-stage" key="computer">
          <h1>A computer you can ignore.</h1>
          <p className="lede">
            Shut the laptop. Open the thread on your phone. The computer lives
            in the cloud — on that bot, not a second product you hire.
          </p>
          <GateAnywhere hero />
          <div className="gate-nav">
            <Button variant="ghost" type="button" onClick={() => go(0)}>
              Back
            </Button>
            <Button type="button" onClick={() => go(2)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="gate-stage" key="tools">
          <h1>Which tools do you use?</h1>
          <p className="lede">
            This only shapes suggestions. Nothing connects yet. We’ll ask when
            the Bot hits a wall.
          </p>
          <div className="gate-tools">
            {TOOLS.map(({ name, logo }) => (
              <Chip
                key={name}
                selected={tools.includes(name)}
                onClick={() =>
                  setTools(
                    tools.includes(name)
                      ? tools.filter((item) => item !== name)
                      : [...tools, name],
                  )
                }
              >
                <img
                  src={logo}
                  alt=""
                  width={14}
                  height={14}
                  decoding="async"
                  className="size-3.5 shrink-0"
                />
                {name}
              </Chip>
            ))}
          </div>
          <div className="gate-nav">
            <Button variant="ghost" type="button" onClick={() => go(1)}>
              Back
            </Button>
            <Button type="button" onClick={() => go(3)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="gate-stage" key="models">
          <h1>Any model. Not locked in.</h1>
          <p className="lede">
            {modelsReady
              ? settings?.hostedGateway
                ? "Groxbot includes hosted models. Continue to hire, or paste your own key later in Settings."
                : "This workspace already has a model key. Continue to hire your first teammate."
              : "Groxbot includes hosted models when they are configured on this host. Or paste an OpenRouter key — one key covers Claude, GPT, Grok, Kimi, DeepSeek."}
          </p>
          <div className="model-strip" aria-hidden>
            {MODEL_MARKS.map((mark) => (
              <img
                key={mark.name}
                className={`model-icon ${mark.tone}`}
                src={mark.src}
                alt=""
                width={22}
                height={22}
                title={mark.name}
              />
            ))}
          </div>
          {!settings ? (
            <p className="lede">
              {modelsQuery.error ? "Could not load models." : "Loading…"}
            </p>
          ) : modelsReady ? (
            <p className="ok">
              Ready · {selectedMeta?.label ?? settings.defaultModelId}
            </p>
          ) : (
            <>
              <Field label="Default model">
                <Select
                  aria-label="Default model"
                  value={selectedModel}
                  onValueChange={setDefaultModel}
                  groups={modelGroups}
                />
              </Field>
              {selectedProvider === "openrouter" ? (
                <Field
                  label={
                    <>
                      OpenRouter key
                      <em className="font-normal text-muted"> · recommended</em>
                    </>
                  }
                  hint={
                    <>
                      {PROVIDER_META.openrouter.hint}{" "}
                      <a
                        href={PROVIDER_META.openrouter.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get a key
                      </a>
                    </>
                  }
                >
                  <Input
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder={
                      providerStatus?.configured
                        ? "Leave blank to keep"
                        : PROVIDER_META.openrouter.placeholder
                    }
                    value={openrouterKey}
                    onValueChange={setOpenrouterKey}
                  />
                </Field>
              ) : null}
              {selectedProvider === "anthropic" ? (
                <Field
                  label="Anthropic key"
                  hint={
                    <>
                      {PROVIDER_META.anthropic.hint}{" "}
                      <a
                        href={PROVIDER_META.anthropic.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get a key
                      </a>
                    </>
                  }
                >
                  <Input
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder={PROVIDER_META.anthropic.placeholder}
                    value={anthropicKey}
                    onValueChange={setAnthropicKey}
                  />
                </Field>
              ) : null}
              {selectedProvider === "openai" ? (
                <Field
                  label="OpenAI key"
                  hint={
                    <>
                      {PROVIDER_META.openai.hint}{" "}
                      <a
                        href={PROVIDER_META.openai.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Get a key
                      </a>
                    </>
                  }
                >
                  <Input
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    placeholder={PROVIDER_META.openai.placeholder}
                    value={openaiKey}
                    onValueChange={setOpenaiKey}
                  />
                </Field>
              ) : null}
              {selectedProvider === CLOUDFLARE_PROVIDER ? (
                <>
                  <Field
                    label="Cloudflare API token"
                    hint={
                      <>
                        {PROVIDER_META.cloudflare.hint}{" "}
                        <a
                          href={PROVIDER_META.cloudflare.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Get a key
                        </a>
                      </>
                    }
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder={PROVIDER_META.cloudflare.placeholder}
                      value={cloudflareToken}
                      onValueChange={setCloudflareToken}
                    />
                  </Field>
                  <Field label="Account id">
                    <Input
                      placeholder="32-character account id"
                      spellCheck={false}
                      autoComplete="off"
                      value={cfAccount}
                      onValueChange={setCfAccount}
                    />
                  </Field>
                  <Field label="AI Gateway id">
                    <Input
                      placeholder={DEFAULT_AI_GATEWAY_ID}
                      spellCheck={false}
                      autoComplete="off"
                      value={cfGateway}
                      onValueChange={setCfGateway}
                    />
                  </Field>
                </>
              ) : null}
            </>
          )}
          {error ? <p className="error">{error}</p> : null}
          <div className="gate-nav">
            <Button variant="ghost" type="button" onClick={() => go(2)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={
                busy || !settings || (!modelsReady && !canContinueModels)
              }
              onClick={() => void saveModels()}
            >
              {busy ? "Saving…" : "Continue"}
            </Button>
          </div>
        </div>
      ) : null}
      {step === 4 ? (
        <div className="gate-stage" key="hire">
          <h1>Who should we hire first?</h1>
          <p className="lede">
            Pick a job — or write your own. Chief of Staff is a good first hire.
          </p>
          <div className="gate-tools">
            {SUGGESTED_JOBS.map((job) => (
              <Chip key={job.title} onClick={() => pickJob(job)}>
                {job.title}
              </Chip>
            ))}
          </div>
          <div className="gate-nav">
            <Button variant="ghost" type="button" onClick={() => go(3)}>
              Back
            </Button>
            <Button variant="ghost" type="button" onClick={() => go(5)}>
              Create your own
            </Button>
          </div>
        </div>
      ) : null}
      {step === 5 ? (
        <div className="gate-stage" key="profile">
          <h1>Name + how it should work.</h1>
          <p className="lede">
            A Bot is a contact: name, optional job, and the rules it should
            follow.
          </p>
          <div className="my-3 mb-5 flex items-center gap-4">
            <AvatarMark name={name} color={color} shape={shape} large hero />
            <div>
              <div className="swatches">
                {AVATAR_COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`swatch${color === value ? " on" : ""}`}
                    style={{ background: value }}
                    onClick={() => setColor(value)}
                  />
                ))}
              </div>
              <ShapePicks
                color={color}
                value={shape}
                shapes={AVATAR_SHAPES}
                onChange={setShape}
              />
            </div>
          </div>
          <Field label="Name">
            <Input value={name} onValueChange={setName} required />
          </Field>
          <Field label="Job (optional)">
            <Input value={title} onValueChange={setTitle} />
          </Field>
          <Field label="How it should work">
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <div className="gate-nav">
            <Button variant="ghost" type="button" onClick={() => go(4)}>
              Back
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              {busy ? "Hiring…" : "Open the thread"}
            </Button>
          </div>
        </div>
      ) : null}
    </>,
  );
}
