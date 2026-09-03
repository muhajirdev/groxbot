import type { Me, ModelCatalogItem, ModelProvider } from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  DEFAULT_AI_GATEWAY_ID,
  missingProviderMessage,
  PROVIDER_META,
  PROVIDER_ORDER,
  catalogGroupLabel,
  pickerCatalog,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { encodeProfileImage } from "../lib/profile-image";
import {
  type LocalComputerPref,
  readAutoReview,
  readAutoReviewRules,
  readHardwareAccel,
  readLocalComputer,
  writeAutoReview,
  writeAutoReviewRules,
  writeHardwareAccel,
  writeLocalComputer,
} from "../lib/prefs";
import { client } from "../lib/rpc";
import type { Theme } from "../lib/theme";
import {
  canSaveWorkspaceName,
  writeCachedWorkspace,
} from "../lib/workspace-switcher";
import { ModalShell } from "../ui";
import { PersonAvatar } from "./PersonAvatar";
import { ChevronDownIcon, CloseIcon } from "./Icons";

type Tab = "general" | "models" | "billing" | "updates";

export function AppSettings(props: {
  open: boolean;
  me: Me | undefined;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onClose: () => void;
  onSignOut: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "general");
  const [hw, setHw] = useState(readHardwareAccel);
  const [local, setLocal] = useState(readLocalComputer);
  const [review, setReview] = useState(readAutoReview);
  const [rules, setRules] = useState(readAutoReviewRules);
  const zone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  useEffect(() => {
    if (props.open) setTab(props.initialTab ?? "general");
  }, [props.open, props.initialTab]);

  return (
    <ModalShell
      open={props.open}
      wide
      className="h-[min(86vh,720px)]"
      onClose={props.onClose}
    >
      <div className="settings-shell">
        <nav className="settings-nav">
          {(
            [
              ["general", "General"],
              ["models", "Models"],
              ["billing", "Usage & Billing"],
              ["updates", "Updates"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`nav-item${tab === id ? " on" : ""}`}
              type="button"
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <div className="modal-head">
            <h2>
              {tab === "general"
                ? "General"
                : tab === "models"
                  ? "Models"
                  : tab === "billing"
                    ? "Usage & Billing"
                    : "Updates"}
            </h2>
            <button
              className="icon-btn"
              type="button"
              aria-label="Close"
              onClick={props.onClose}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="settings-body">
            {tab === "general" ? (
              <>
                <section className="set-block">
                  <p className="group-label">Account</p>
                  <div className="account-row">
                    <ProfilePhotoButton
                      name={props.me?.name || "You"}
                      image={props.me?.image}
                      disabled={!props.me}
                    />
                    <div>
                      <strong>{props.me?.name || "You"}</strong>
                      <p className="muted">{props.me?.email}</p>
                    </div>
                    <button
                      className="mini"
                      type="button"
                      onClick={props.onSignOut}
                    >
                      Sign Out
                    </button>
                  </div>
                </section>
                <section className="set-block">
                  <p className="group-label">Workspace</p>
                  <WorkspaceSettings
                    key={props.me?.workspaceId ?? "none"}
                    name={props.me?.workspaceName}
                    enabled={Boolean(props.me && !props.me.needsWorkspace)}
                    me={props.me}
                  />
                </section>
                <section className="set-block">
                  <p className="group-label">Appearance</p>
                  <label className="field">
                    <span>Theme</span>
                    <select
                      value={props.theme}
                      onChange={(e) => props.onTheme(e.target.value as Theme)}
                    >
                      <option value="system">Follow System</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </label>
                </section>
                <section className="set-block">
                  <p className="group-label">System</p>
                  <label className="toggle-row">
                    <span>
                      <strong>Use hardware acceleration</strong>
                    </span>
                    <input
                      type="checkbox"
                      checked={hw}
                      onChange={(e) => {
                        setHw(e.target.checked);
                        writeHardwareAccel(e.target.checked);
                      }}
                    />
                  </label>
                </section>
                <section className="set-block">
                  <p className="group-label">Bot</p>
                  <label className="field">
                    <span>Timezone</span>
                    <select defaultValue="auto">
                      <option value="auto">Auto-detect ({zone})</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Execution on Local Computer</span>
                    <select
                      value={local}
                      onChange={(e) => {
                        const value = e.target.value as LocalComputerPref;
                        setLocal(value);
                        writeLocalComputer(value);
                      }}
                    >
                      <option value="ask">Ask every time</option>
                      <option value="always">Always allow</option>
                      <option value="never">Never</option>
                    </select>
                    <p className="hint">
                      Let the assistant open files and run tasks on this
                      machine. Auto-review still checks everything first. Never
                      enable this for a hosted teammate.
                    </p>
                  </label>
                  <label className="toggle-row">
                    <span>
                      <strong>Auto-review</strong>
                    </span>
                    <input
                      type="checkbox"
                      checked={review}
                      onChange={(e) => {
                        setReview(e.target.checked);
                        writeAutoReview(e.target.checked);
                      }}
                    />
                  </label>
                  <p className="hint">
                    Checks each action before it runs and asks you first when
                    needed. Add rules to customize what it can do automatically.
                  </p>
                  <label className="field">
                    <span>Auto-review Rules</span>
                    <textarea
                      rows={3}
                      value={rules}
                      placeholder="Write one short, natural-language rule for each action. 'Ask first' takes priority if rules conflict."
                      onChange={(e) => {
                        setRules(e.target.value);
                        writeAutoReviewRules(e.target.value);
                      }}
                    />
                  </label>
                </section>
              </>
            ) : null}
            {tab === "models" ? <ModelsTab /> : null}
            {tab === "billing" ? <BillingTab /> : null}
            {tab === "updates" ? (
              <p className="muted">You're on the local build of Groxbot.</p>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

async function saveAccount(input: {
  name?: string;
  image?: { content: string } | null;
}) {
  return client.account.update(input);
}

function ProfilePhotoButton(props: {
  name: string;
  image?: string | null;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File | undefined) {
    if (!file || props.disabled) return;
    setBusy(true);
    setError("");
    try {
      const encoded = await encodeProfileImage(file);
      const next = await saveAccount({ image: { content: encoded.content } });
      queryClient.setQueryData(orpc.me.key(), (prev: Me | undefined) =>
        prev ? { ...prev, name: next.name, image: next.image } : prev,
      );
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      await queryClient.invalidateQueries({
        queryKey: orpc.workspaces.members.key(),
      });
      props.onSaved?.();
    } catch (caught) {
      setError(userFacingError(caught, "Could not save that photo"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="member-photo">
      <button
        type="button"
        className="member-photo-btn"
        disabled={props.disabled || busy}
        aria-label={busy ? "Saving photo" : "Change photo"}
        title="Change photo"
        onClick={() => inputRef.current?.click()}
      >
        <PersonAvatar name={props.name} image={props.image} size="md" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      {error ? <p className="member-photo-error">{error}</p> : null}
    </div>
  );
}

function WorkspaceSettings(props: {
  name: string | null | undefined;
  enabled: boolean;
  me: Me | undefined;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);
  const name = draft ?? props.name ?? "";
  const dirty = canSaveWorkspaceName(props.name, name);
  const membersQuery = useQuery({
    ...orpc.workspaces.members.queryOptions(),
    enabled: props.enabled,
  });
  const [memberName, setMemberName] = useState(props.me?.name ?? "");
  const [savingMember, setSavingMember] = useState(false);

  useEffect(() => {
    setMemberName(props.me?.name ?? "");
  }, [props.me?.name]);

  async function saveName() {
    const trimmed = name.trim();
    if (!props.enabled || !canSaveWorkspaceName(props.name, trimmed)) return;
    setSaving(true);
    setError("");
    try {
      await client.workspaces.update({ name: trimmed });
      writeCachedWorkspace({ id: props.me?.workspaceId, name: trimmed });
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
    } catch (caught) {
      setError(userFacingError(caught, "Could not update workspace name"));
    } finally {
      setSaving(false);
    }
  }

  async function saveMemberName() {
    const trimmed = memberName.trim();
    if (!trimmed || trimmed === (props.me?.name ?? "").trim()) return;
    setSavingMember(true);
    setError("");
    try {
      const next = await saveAccount({ name: trimmed });
      queryClient.setQueryData(orpc.me.key(), (prev: Me | undefined) =>
        prev ? { ...prev, name: next.name, image: next.image } : prev,
      );
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      await queryClient.invalidateQueries({
        queryKey: orpc.workspaces.members.key(),
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not update your name"));
    } finally {
      setSavingMember(false);
    }
  }

  async function send() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    setCopied(false);
    setSent(null);
    try {
      const invite = await client.workspaces.invite({ email: trimmed });
      setSent({ email: invite.email, url: invite.url });
      setEmail("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not send invite"));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.url);
      setCopied(true);
    } catch {
      setError("Copy the link from the field below.");
    }
  }

  return (
    <>
      {props.enabled ? (
        <form
          className="field"
          onSubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <span>Name</span>
          <input
            value={name}
            maxLength={80}
            autoComplete="organization"
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
          />
          <button
            className="mini"
            type="submit"
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <p className="muted">{props.name || "This workspace"}</p>
      )}
      {props.enabled ? (
        <div className="member-list">
          <span className="field-label">Members</span>
          {membersQuery.isPending ? (
            <p className="muted">Loading…</p>
          ) : membersQuery.error ? (
            <p className="muted">Could not load members.</p>
          ) : (
            (membersQuery.data ?? []).map((row) => (
              <div key={row.userId} className="member-row">
                {row.mine ? (
                  <ProfilePhotoButton name={row.name} image={row.image} />
                ) : (
                  <PersonAvatar name={row.name} image={row.image} size="md" />
                )}
                <div className="member-meta">
                  {row.mine ? (
                    <form
                      className="member-name"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveMemberName();
                      }}
                    >
                      <input
                        value={memberName}
                        maxLength={80}
                        aria-label="Your name"
                        disabled={savingMember}
                        onChange={(event) => setMemberName(event.target.value)}
                      />
                      <button
                        className="mini"
                        type="submit"
                        disabled={
                          savingMember ||
                          !memberName.trim() ||
                          memberName.trim() === (props.me?.name ?? "").trim()
                        }
                      >
                        {savingMember ? "Saving…" : "Save"}
                      </button>
                    </form>
                  ) : (
                    <strong>{row.name}</strong>
                  )}
                  <p className="muted">
                    {row.mine ? "You · " : ""}
                    {row.email}
                  </p>
                </div>
                <span className="member-role">{row.role}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
      {props.enabled ? (
        <>
          <form
            className="field"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <span>Invite by email</span>
            <input
              type="email"
              value={email}
              placeholder="teammate@company.com"
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              className="mini"
              type="submit"
              disabled={busy || !email.trim()}
            >
              {busy ? "Sending…" : "Send invite"}
            </button>
          </form>
          {error ? <p className="muted">{error}</p> : null}
          {sent ? (
            <div className="field">
              <p className="muted">
                Invite emailed to {sent.email}. They open the link and join. You
                can also copy the link:
              </p>
              <input readOnly value={sent.url} />
              <button
                className="mini"
                type="button"
                onClick={() => void copyLink()}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Create a workspace first, then invite people.</p>
      )}
    </>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function BillingTab() {
  const query = useQuery(orpc.models.get.queryOptions());
  const settings = query.data;
  if (!settings) {
    return (
      <p className="muted">{query.error ? "Could not load." : "Loading…"}</p>
    );
  }
  if (!settings.hostedGateway && settings.usage.requests === 0) {
    return (
      <p className="muted">
        Usage is counted when this workspace uses Groxbot’s included models.
        Your own keys are not metered here.
      </p>
    );
  }
  return (
    <section className="set-block">
      <p className="group-label">This workspace</p>
      <p className="hint">
        Included models only. Your own keys are not counted. Per person rollups
        come later.
      </p>
      <p>
        {formatCount(settings.usage.requests)} requests ·{" "}
        {formatCount(settings.usage.totalTokens)} tokens
      </p>
      <p className="muted">
        {formatCount(settings.usage.promptTokens)} prompt ·{" "}
        {formatCount(settings.usage.completionTokens)} completion
      </p>
    </section>
  );
}

function ModelsTab() {
  const queryClient = useQueryClient();
  const query = useQuery(orpc.models.get.queryOptions());
  const settings = query.data;
  const [drafts, setDrafts] = useState<Partial<Record<ModelProvider, string>>>(
    {},
  );
  const [accountId, setAccountId] = useState<string>();
  const [gatewayId, setGatewayId] = useState<string>();
  const [defaultModel, setDefaultModel] = useState<string>();
  const [customModel, setCustomModel] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [openKeys, setOpenKeys] = useState<
    Partial<Record<ModelProvider, boolean>>
  >({});

  const selectedModel = defaultModel ?? settings?.defaultModel ?? "";
  const custom = customModel ?? settings?.customModel ?? "";
  const cf = settings?.keys.find(
    (item) => item.provider === CLOUDFLARE_PROVIDER,
  );
  const cfAccount = accountId ?? cf?.accountId ?? "";
  const cfGateway = gatewayId ?? cf?.gatewayId ?? "";
  const providers = PROVIDER_ORDER;
  const pickerItems = pickerCatalog(
    settings?.catalog ?? [],
    selectedModel === CUSTOM_MODEL_SENTINEL
      ? settings?.defaultModelId ?? ""
      : selectedModel,
  );
  const grouped = new Map<ModelProvider, ModelCatalogItem[]>();
  for (const item of pickerItems) {
    const list = grouped.get(item.provider) ?? [];
    list.push(item);
    grouped.set(item.provider, list);
  }
  const selectedMeta = settings?.catalog.find(
    (item) => item.id === selectedModel,
  );
  const neededProvider =
    selectedModel !== CUSTOM_MODEL_SENTINEL &&
    selectedMeta &&
    !selectedMeta.available
      ? selectedMeta.provider
      : undefined;
  const warning =
    selectedModel === CUSTOM_MODEL_SENTINEL
      ? settings?.warning
      : neededProvider
        ? missingProviderMessage(selectedModel)
        : settings?.warning;

  function keyExpanded(provider: ModelProvider) {
    if (openKeys[provider] !== undefined) return Boolean(openKeys[provider]);
    return neededProvider === provider;
  }

  function toggleKey(provider: ModelProvider) {
    setOpenKeys((current) => ({
      ...current,
      [provider]: !keyExpanded(provider),
    }));
  }

  async function save() {
    if (!settings) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const next = await client.models.save({
        defaultModel: selectedModel || CUSTOM_MODEL_SENTINEL,
        customModel: custom,
        keys: providers.map((provider) => ({
          provider,
          secret: drafts[provider]?.trim() || undefined,
          accountId:
            provider === CLOUDFLARE_PROVIDER
              ? cfAccount.trim() || undefined
              : undefined,
          gatewayId:
            provider === CLOUDFLARE_PROVIDER
              ? cfGateway.trim() || undefined
              : undefined,
        })),
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      setDrafts({});
      setSaved(true);
    } catch (caught) {
      setError(userFacingError(caught, "Could not save"));
    } finally {
      setBusy(false);
    }
  }

  async function clear(provider: ModelProvider) {
    if (!settings) return;
    if (!window.confirm("Remove this key from the office?")) return;
    setBusy(true);
    setError("");
    try {
      const next = await client.models.save({
        defaultModel: selectedModel || settings.defaultModel,
        customModel: custom,
        keys: [{ provider, clear: true }],
      });
      queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      if (provider === CLOUDFLARE_PROVIDER) {
        setAccountId("");
        setGatewayId("");
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not clear"));
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <p className="muted">{query.error ? "Could not load." : "Loading…"}</p>
    );
  }

  return (
    <>
      <section className="set-block">
        <p className="group-label">Default model</p>
        <p className="hint">
          Every teammate uses this unless you override it on that bot.
        </p>
        <label className="field">
          <span>Model</span>
          <select
            value={selectedModel}
            onChange={(e) => {
              const next = e.target.value;
              setDefaultModel(next);
              const meta = settings.catalog.find((item) => item.id === next);
              if (meta && !meta.available) {
                setOpenKeys((current) => ({
                  ...current,
                  [meta.provider]: true,
                }));
              }
            }}
          >
            {[...grouped.entries()].map(([provider, items]) => (
              <optgroup key={provider} label={catalogGroupLabel(provider)}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.available ? "" : " — needs key"}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM_MODEL_SENTINEL}>Custom…</option>
          </select>
        </label>
        {selectedModel === CUSTOM_MODEL_SENTINEL ? (
          <label className="field">
            <span>Model id</span>
            <input
              value={custom}
              placeholder="openrouter/deepseek/deepseek-v4-flash"
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setCustomModel(e.target.value)}
            />
          </label>
        ) : null}
        {warning ? <p className="model-warn">{warning}</p> : null}
      </section>
      <section className="set-block">
        <p className="group-label">Provider keys</p>
        <p className="hint">
          Groxbot includes hosted models so you can start without a key. Paste
          your own anytime — your key wins when it is on file.
        </p>
        <div className="provider-keys">
          <div
            className={`provider-key${settings.hostedGateway ? "" : " soon"}`}
          >
            <div className="provider-key-toggle" aria-disabled="true">
              <span className="provider-name">
                Groxbot
                <em className="muted"> · hosted</em>
              </span>
              <span
                className={`provider-status${settings.hostedGateway ? " ok" : " soon"}`}
              >
                {settings.hostedGateway ? "Included" : "Not on this host"}
              </span>
            </div>
            {settings.hostedGateway ? (
              <div className="provider-key-body">
                <p className="hint">
                  This workspace uses Groxbot’s included models. Token counts
                  are per workspace.
                </p>
                <p className="muted">
                  {formatCount(settings.usage.requests)} requests ·{" "}
                  {formatCount(settings.usage.totalTokens)} tokens
                </p>
              </div>
            ) : null}
          </div>
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider];
            const status = settings.keys.find(
              (item) => item.provider === provider,
            );
            const expanded = keyExpanded(provider);
            const statusLabel = status?.configured
              ? (status.hint ?? "on file")
              : neededProvider === provider
                ? "needs key"
                : "no key";
            return (
              <div
                key={provider}
                className={`provider-key${expanded ? " open" : ""}`}
              >
                <button
                  className="provider-key-toggle"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggleKey(provider)}
                >
                  <span className="provider-name">
                    {meta.label}
                    {meta.recommended ? (
                      <em className="muted"> · recommended</em>
                    ) : null}
                  </span>
                  <span
                    className={`provider-status${status?.configured ? " ok" : neededProvider === provider ? " warn" : ""}`}
                  >
                    {statusLabel}
                  </span>
                  <ChevronDownIcon className="provider-chevron" />
                </button>
                {expanded ? (
                  <div className="provider-key-body">
                    <p className="hint">
                      {meta.hint}{" "}
                      <a href={meta.docsUrl} target="_blank" rel="noreferrer">
                        Get a key
                      </a>
                    </p>
                    <label className="field">
                      <span className="sr-only">
                        {meta.label}{" "}
                        {provider === CLOUDFLARE_PROVIDER
                          ? "API token"
                          : "API key"}
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        spellCheck={false}
                        placeholder={
                          status?.configured
                            ? "Leave blank to keep"
                            : meta.placeholder
                        }
                        value={drafts[provider] ?? ""}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [provider]: e.target.value,
                          }))
                        }
                      />
                    </label>
                    {provider === CLOUDFLARE_PROVIDER ? (
                      <>
                        <input
                          placeholder="32-character account id"
                          spellCheck={false}
                          autoComplete="off"
                          value={cfAccount}
                          onChange={(e) => setAccountId(e.target.value)}
                        />
                        <input
                          placeholder={`AI Gateway id (${DEFAULT_AI_GATEWAY_ID})`}
                          spellCheck={false}
                          autoComplete="off"
                          value={cfGateway}
                          onChange={(e) => setGatewayId(e.target.value)}
                        />
                      </>
                    ) : null}
                    {status?.source === "workspace" ? (
                      <button
                        className="text-btn"
                        type="button"
                        disabled={busy}
                        onClick={() => void clear(provider)}
                      >
                        Remove key
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p className="hint">Saved.</p> : null}
      <button
        className="btn"
        type="button"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save models"}
      </button>
    </>
  );
}
