import type { Me, ModelCatalogItem, ModelProvider } from "@groxbot/contracts";
import {
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  DEFAULT_AI_GATEWAY_ID,
  missingProviderMessage,
  PROVIDER_META,
  PROVIDER_ORDER,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
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
import { ModalShell } from "../ui";
import { ChevronDownIcon, CloseIcon } from "./Icons";

type Tab = "general" | "models" | "billing" | "updates";

export function AppSettings(props: {
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

  return (
    <ModalShell wide onClose={props.onClose}>
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
                  <WorkspaceInvite
                    name={props.me?.workspaceName}
                    enabled={Boolean(props.me && !props.me.needsWorkspace)}
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

function WorkspaceInvite(props: {
  name: string | null | undefined;
  enabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);

  async function send() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
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

  return (
    <>
      <p className="muted">{props.name || "This workspace"}</p>
      {props.enabled ? (
        <>
          <label className="field">
            <span>Invite by email</span>
            <input
              type="email"
              value={email}
              placeholder="teammate@company.com"
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            className="mini"
            type="button"
            disabled={busy || !email.trim()}
            onClick={() => void send()}
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
          {error ? <p className="muted">{error}</p> : null}
          {sent ? (
            <p className="muted">
              Invite sent to {sent.email}. Share this link if they need it:{" "}
              {sent.url}
            </p>
          ) : null}
        </>
      ) : null}
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
        Usage is counted when this workspace uses Groxbot’s included Cloudflare
        AI Gateway. Bring-your-own keys are not metered here.
      </p>
    );
  }
  return (
    <section className="set-block">
      <p className="group-label">This workspace</p>
      <p className="hint">
        Hosted Cloudflare AI Gateway only. Your own keys are not counted. Per
        person rollups come later.
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
  const grouped = new Map<ModelProvider, ModelCatalogItem[]>();
  for (const item of settings?.catalog ?? []) {
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
              <optgroup key={provider} label={PROVIDER_META[provider].label}>
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
          Groxbot includes Cloudflare AI Gateway so you can start without a key.
          Paste your own anytime — BYOK wins when it is on file.
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
                  This workspace uses Groxbot’s Cloudflare AI Gateway. Token
                  counts are per workspace.
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
