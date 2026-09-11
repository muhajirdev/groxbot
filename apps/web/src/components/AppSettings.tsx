import type { Me, ModelProvider, ThinkingEffort, WorkspaceMember } from "@groxbot/contracts";
import {
  canSaveDefaultModelChoice,
  CLOUDFLARE_PROVIDER,
  CUSTOM_MODEL_SENTINEL,
  DEFAULT_AI_GATEWAY_ID,
  missingProviderMessage,
  OPENAI_CODEX_PROVIDER,
  OPENAI_CODEX_SETUP_STEPS,
  isOpenAiCodexModel,
  PRO_TRIAL_INTERVAL_COUNT,
  PROVIDER_META,
  PROVIDER_ORDER,
  pickerCatalog,
  isGroxbotRouterModel,
  parseThinkingEffort,
  WORKSPACE_PLAN_BELIEVERS,
  WORKSPACE_PLAN_PLUS,
  WORKSPACE_PLAN_PRO,
  type WorkspacePlan,
} from "@groxbot/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { billingStatusLabel } from "../lib/billing-format";
import { BUILD_REVISION, shortRevision } from "../lib/build";
import { readDebugMode, useDebugMode, writeDebugMode } from "../lib/debug-mode";
import { userFacingError } from "../lib/errors";
import { modelKeyDraftsReady, modelKeySavePayload } from "../lib/model-settings";
import type { OfficeColorId } from "../lib/office-color";
import { workspaceListQueryOptions } from "../lib/office-persist";
import { OFFICE_TO, officeParams, WORKSPACE_TO } from "../lib/office-route";
import { orpc } from "../lib/orpc";
import { readTimezonePref, writeTimezonePref } from "../lib/prefs";
import { encodeProfileImage } from "../lib/profile-image";
import { client } from "../lib/rpc";
import { setLiveCatalogId, setRpcWorkspaceId } from "../lib/rpc-workspace";
import { enterActiveWorkspace } from "../lib/session";
import {
  forgetListedWorkspace,
  rememberListedWorkspace,
  workspaceCatalogKey,
} from "../lib/workspace-catalog";
import {
  canDeleteWorkspace,
  canSaveWorkspaceName,
  clearCachedWorkspace,
  forgetLastRoom,
  writeCachedWorkspace,
} from "../lib/workspace-switcher";
import { Button, ModalShell } from "../ui";
import { ChevronDownIcon, CloseIcon } from "./Icons";
import { OfficeLookList } from "./OfficeColorPicker";
import { PersonAvatar } from "./PersonAvatar";
import { EffortField } from "./EffortField";
import { ModelField } from "./ModelField";
import { TimezoneField } from "./TimezoneField";

type Tab = "general" | "appearance" | "models" | "billing" | "updates";

export type SettingsTab = Tab;

export const DEFAULT_SETTINGS_TAB: Tab = "appearance";

const TAB_LABEL: Record<Tab, string> = {
  appearance: "Appearance",
  general: "General",
  models: "Models",
  billing: "Usage & Billing",
  updates: "Updates",
};

export function AppSettings(props: {
  open: boolean;
  me: Me | undefined;
  officeColor: OfficeColorId;
  onOfficeColor: (id: OfficeColorId) => void;
  onClose: () => void;
  onSignOut: () => void;
  onSupport: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? DEFAULT_SETTINGS_TAB);
  const [seen, setSeen] = useState<Partial<Record<Tab, boolean>>>({
    appearance: true,
  });
  const [timezone, setTimezone] = useState(readTimezonePref);

  function showTab(id: Tab) {
    setTab(id);
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }

  useEffect(() => {
    if (props.open) {
      const next = props.initialTab ?? DEFAULT_SETTINGS_TAB;
      setTab(next);
      setSeen((prev) => (prev[next] ? prev : { ...prev, [next]: true }));
      setTimezone(readTimezonePref());
    }
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
              ["appearance", "Appearance"],
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
              onClick={() => showTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <div className="modal-head">
            <h2>{TAB_LABEL[tab]}</h2>
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
            <div className="settings-pane" hidden={tab !== "general"}>
              <section className="set-block">
                <p className="group-label">Account</p>
                <div className="set-row">
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
                  onClose={props.onClose}
                />
              </section>
              <section className="set-block">
                <p className="group-label">Developer</p>
                <div className="set-row">
                  <div>
                    <strong>Debug</strong>
                    <p className="muted">
                      Turn timing log on this bot&apos;s computer pane
                    </p>
                  </div>
                  <DebugModeToggle />
                </div>
              </section>
              <section className="set-block">
                <p className="group-label">Timezone</p>
                <p className="hint set-lede">
                  Wall-clock routines run in this zone.
                </p>
                <TimezoneField
                  value={timezone}
                  onChange={(value) => {
                    setTimezone(value);
                    writeTimezonePref(value);
                  }}
                  className="bg-card-2"
                />
              </section>
              <section className="set-block">
                <p className="group-label">Support</p>
                <div className="set-row">
                  <div>
                    <strong>Live chat</strong>
                    <p className="muted">We usually reply in a few minutes</p>
                  </div>
                  <button
                    className="mini"
                    type="button"
                    onClick={props.onSupport}
                  >
                    Chat with us
                  </button>
                </div>
              </section>
              <section className="set-block">
                <p className="group-label">Build</p>
                <BuildStamp />
              </section>
            </div>
            {seen.appearance ? (
              <div className="settings-pane" hidden={tab !== "appearance"}>
                <section className="set-block">
                  <p className="group-label">Look</p>
                  <OfficeLookList
                    value={props.officeColor}
                    onChange={props.onOfficeColor}
                  />
                </section>
              </div>
            ) : null}
            {seen.models ? (
              <div className="settings-pane" hidden={tab !== "models"}>
                <ModelsTab />
              </div>
            ) : null}
            {seen.billing ? (
              <div className="settings-pane" hidden={tab !== "billing"}>
                <BillingTab />
              </div>
            ) : null}
            {seen.updates ? (
              <div className="settings-pane" hidden={tab !== "updates"}>
                <section className="set-block">
                  <p className="group-label">Revision</p>
                  <BuildStamp />
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DebugModeToggle() {
  const on = useDebugMode();
  return (
    <button
      className="mini"
      type="button"
      aria-pressed={on}
      onClick={() => writeDebugMode(!readDebugMode())}
    >
      {on ? "On" : "Off"}
    </button>
  );
}

function BuildStamp() {
  const short = shortRevision(BUILD_REVISION);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(BUILD_REVISION).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="set-row">
      <div>
        <strong>{copied ? "Copied" : short}</strong>
        <p className="muted">Git revision</p>
      </div>
      <button
        className="mini"
        type="button"
        title={BUILD_REVISION}
        onClick={copy}
      >
        Copy
      </button>
    </div>
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
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);
  const name = draft ?? props.name ?? "";
  const dirty = canSaveWorkspaceName(props.name, name);
  const listed =
    queryClient.getQueryData(workspaceListQueryOptions().queryKey) ?? [];
  const onlyOffice = listed.every((item) => item.id === props.me?.workspaceId);
  const membersQuery = useQuery({
    ...orpc.workspaces.members.queryOptions(),
    enabled: props.enabled,
  });
  const members =
    membersQuery.data ??
    (props.me
      ? [
          {
            userId: props.me.userId,
            name: props.me.name,
            email: props.me.email,
            image: props.me.image,
            role: "owner",
            mine: true,
          } satisfies WorkspaceMember,
        ]
      : []);
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
      writeCachedWorkspace({
        id: props.me?.workspaceId,
        name: trimmed,
        slug: props.me?.workspaceSlug,
      });
      rememberListedWorkspace({
        id: props.me?.workspaceId,
        name: trimmed,
        slug: props.me?.workspaceSlug,
      });
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

  async function deleteWorkspace() {
    const deletedId = props.me?.workspaceId?.trim();
    if (!props.enabled || !deletedId || deleting) return;
    setDeleting(true);
    setError("");
    try {
      const result = await client.workspaces.delete();
      forgetListedWorkspace(deletedId);
      forgetLastRoom(deletedId);
      queryClient.removeQueries({ queryKey: workspaceCatalogKey(deletedId) });
      props.onClose();
      const next = result.next;
      if (next) {
        rememberListedWorkspace(next);
        writeCachedWorkspace(next);
        setRpcWorkspaceId(next.id);
        await enterActiveWorkspace({
          workspace: next,
          goWorkspace: () =>
            navigate({
              to: WORKSPACE_TO,
              params: { workspaceSlug: next.slug },
              viewTransition: true,
            }),
          goBot: (roomId) =>
            navigate({
              to: OFFICE_TO,
              params: officeParams(next.slug, roomId),
              viewTransition: true,
            }),
        });
        await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
        await queryClient.invalidateQueries({
          queryKey: workspaceListQueryOptions().queryKey,
        });
        return;
      }
      clearCachedWorkspace();
      setRpcWorkspaceId(null);
      setLiveCatalogId(null);
      queryClient.setQueryData(orpc.me.key(), (prev: Me | undefined) =>
        prev
          ? {
              ...prev,
              workspaceId: null,
              workspaceName: null,
              workspaceSlug: null,
              needsWorkspace: true,
            }
          : prev,
      );
      await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
      await queryClient.invalidateQueries({
        queryKey: workspaceListQueryOptions().queryKey,
      });
      await navigate({ to: "/" });
    } catch (caught) {
      setError(userFacingError(caught, "Could not delete workspace"));
      setDeleting(false);
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
          <div className="field-row">
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
            <button className="mini" type="submit" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">{props.name || "This workspace"}</p>
      )}
      {props.enabled ? (
        <>
          <span className="field-label">Members</span>
          <div className="member-list set-card">
            {membersQuery.error && !membersQuery.data ? (
              <p className="muted">Could not load members.</p>
            ) : (
              members.map((row) => (
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
        </>
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
            <div className="field-row">
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
            </div>
          </form>
          {error ? <p className="warn">{error}</p> : null}
          {sent ? (
            <div className="field">
              <p className="hint set-lede">
                Invite emailed to {sent.email}. They open the link and join.
              </p>
              <div className="field-row">
                <input readOnly value={sent.url} />
                <button
                  className="mini"
                  type="button"
                  onClick={() => void copyLink()}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Create a workspace first, then invite people.</p>
      )}
      {props.enabled && canDeleteWorkspace(membersQuery.data ?? []) ? (
        <div className="set-divide">
          {confirmDelete ? (
            <>
              <p className="group-label">Delete workspace</p>
              <p className="hint set-lede">
                This removes the office, teammates, knowledge, computers, and
                chat. It cannot be undone.
                {onlyOffice ? " We'll open a new empty office after." : ""}
              </p>
              <div className="row">
                <button
                  className="mini"
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <Button
                  className="border-0 bg-danger px-3 py-1.5 text-[13px] text-white"
                  type="button"
                  disabled={deleting}
                  onClick={() => void deleteWorkspace()}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </>
          ) : (
            <button
              className="text-btn danger"
              type="button"
              onClick={() => {
                setConfirmDelete(true);
                setError("");
              }}
            >
              Delete workspace
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function BillingTab() {
  const queryClient = useQueryClient();
  const billingQuery = useQuery(orpc.billing.status.queryOptions());
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState("");

  const billing = billingQuery.data;

  useEffect(() => {
    if (!billing) return;
    queryClient.setQueryData(orpc.me.key(), (prev: Me | undefined) => {
      if (!prev) return prev;
      return {
        ...prev,
        needsHostedPlan: Boolean(
          billing.limitsEnforced && billing.plan === "none",
        ),
      };
    });
  }, [billing, queryClient]);

  if (!billing) {
    return (
      <p className="muted">
        {billingQuery.error ? "Could not load billing." : "Loading…"}
      </p>
    );
  }

  async function startCheckout(plan: Exclude<WorkspacePlan, "none">) {
    setBusy("checkout");
    setError("");
    try {
      const result = await client.billing.checkout({ plan });
      window.location.href = result.url;
    } catch (caught) {
      setError(userFacingError(caught, "Could not start checkout."));
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError("");
    try {
      const result = await client.billing.portal();
      window.location.href = result.url;
    } catch (caught) {
      setError(userFacingError(caught, "Could not open billing portal."));
      setBusy(null);
    }
  }

  const planLabel =
    billing.plan === WORKSPACE_PLAN_BELIEVERS
      ? "Believers"
      : billing.plan === WORKSPACE_PLAN_PLUS
        ? "Pro Plus"
        : billing.plan === WORKSPACE_PLAN_PRO
          ? "Pro"
          : "Free";
  const statusLabel = billingStatusLabel(billing.status);
  const statusTone =
    billing.status === "active"
      ? "is-ok"
      : billing.status === "past_due"
        ? "is-warn"
        : undefined;
  const usagePercent = billing.includedUsagePercent;
  const atLimit = usagePercent !== null && usagePercent >= 100;

  return (
    <>
      <section className="set-block">
        <p className="group-label">Workspace plan</p>
        {billing.enabled ? (
          <>
            <div className="billing-plan">
              <div>
                <strong>{planLabel}</strong>
                {statusLabel ? (
                  <p
                    className={`muted billing-plan-status${statusTone ? ` ${statusTone}` : ""}`}
                  >
                    {statusLabel}
                  </p>
                ) : billing.plan === "none" ? (
                  <p className="muted billing-plan-status">No hosted plan yet</p>
                ) : null}
              </div>
              {billing.portalAvailable && billing.plan !== "none" ? (
                <button
                  type="button"
                  className="mini"
                  aria-label="Manage subscription"
                  disabled={busy !== null}
                  onClick={() => openPortal()}
                >
                  Manage
                </button>
              ) : null}
            </div>
            {billing.checkoutAvailable && billing.plan === "none" ? (
              <>
                <p className="hint">
                  Pro starts with a {PRO_TRIAL_INTERVAL_COUNT}-day trial. Card
                  on file; cancel before it ends and you are not charged. Your
                  own keys still need a plan; they are not counted against
                  hosted usage.
                </p>
                <div className="billing-checkout">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy !== null}
                    onClick={() => startCheckout(WORKSPACE_PLAN_PRO)}
                  >
                    Start {PRO_TRIAL_INTERVAL_COUNT}-day Pro trial
                  </button>
                  <div className="row">
                    <button
                      type="button"
                      className="mini"
                      disabled={busy !== null}
                      onClick={() => startCheckout(WORKSPACE_PLAN_PLUS)}
                    >
                      Pro Plus
                    </button>
                    <button
                      type="button"
                      className="mini"
                      disabled={busy !== null}
                      onClick={() => startCheckout(WORKSPACE_PLAN_BELIEVERS)}
                    >
                      Believers
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="hint">
            Self-host billing is off. Hosted usage on groxbot.com is unlimited
            until Polar is configured.
          </p>
        )}
      </section>

      {usagePercent !== null ? (
        <section className="set-block">
          <p className="group-label">Hosted usage</p>
          <p className="hint billing-usage-lede">
            Included models only. Resets each UTC month. Your own keys are not
            counted.
          </p>
          <div className="billing-usage">
            <div className="billing-usage-head">
              <p>
                <strong>{usagePercent}%</strong> used this month
              </p>
            </div>
            <div
              className="billing-usage-meter"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={usagePercent}
              aria-label="Monthly included hosted usage"
            >
              <span
                className={`billing-usage-fill${atLimit ? " is-cap" : ""}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            {atLimit ? (
              <p className="warn">Monthly included usage reached.</p>
            ) : null}
          </div>
        </section>
      ) : billing.enabled && billing.plan !== "none" ? (
        <section className="set-block">
          <p className="group-label">Hosted usage</p>
          <p className="hint">Usage will show after the first hosted turn.</p>
        </section>
      ) : null}
      {error ? <p className="warn">{error}</p> : null}
    </>
  );
}

function CodexSetupSteps(props: { connected: boolean }) {
  return (
    <div className="codex-setup">
      {props.connected ? (
        <p className="hint">
          Office turns use your ChatGPT subscription. Tokens refresh on their
          own. Re-paste the auth file if you log out of Codex.
        </p>
      ) : (
        <p className="hint">
          This is not an API key. ChatGPT Plus or Pro, then paste the login
          file from your computer.
        </p>
      )}
      <ol className="codex-setup-steps">
        {OPENAI_CODEX_SETUP_STEPS.map((step) => (
          <li key={step.title}>
            <strong>{step.title}.</strong> {step.detail}
          </li>
        ))}
      </ol>
    </div>
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
  const [effort, setEffort] = useState<ThinkingEffort>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [openKeys, setOpenKeys] = useState<
    Partial<Record<ModelProvider, boolean>>
  >({});
  const persistTail = useRef(Promise.resolve());
  const inflight = useRef(0);

  const selectedModel = defaultModel ?? settings?.defaultModel ?? "";
  const custom = customModel ?? settings?.customModel ?? "";
  const selectedEffort = effort ?? settings?.effort ?? "off";
  const cf = settings?.keys.find(
    (item) => item.provider === CLOUDFLARE_PROVIDER,
  );
  const cfAccount = accountId ?? cf?.accountId ?? "";
  const cfGateway = gatewayId ?? cf?.gatewayId ?? "";
  const providers = PROVIDER_ORDER;
  const pickerItems = pickerCatalog(
    settings?.catalog ?? [],
    selectedModel === CUSTOM_MODEL_SENTINEL
      ? (settings?.defaultModelId ?? "")
      : selectedModel,
  );
  const selectedMeta = settings?.catalog.find(
    (item) => item.id === selectedModel,
  );
  const selectedCodexModel =
    selectedModel === CUSTOM_MODEL_SENTINEL
      ? isOpenAiCodexModel(custom)
      : selectedMeta?.provider === OPENAI_CODEX_PROVIDER ||
        isOpenAiCodexModel(selectedModel);
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
    return (
      neededProvider === provider ||
      (selectedCodexModel && provider === OPENAI_CODEX_PROVIDER)
    );
  }

  function toggleKey(provider: ModelProvider) {
    setOpenKeys((current) => ({
      ...current,
      [provider]: !keyExpanded(provider),
    }));
  }

  const keysReady = modelKeyDraftsReady({
    drafts,
    accountId: cfAccount,
    gatewayId: cfGateway,
    savedAccountId: cf?.accountId,
    savedGatewayId: cf?.gatewayId,
    cloudflareConfigured: Boolean(cf?.configured),
  });

  function choiceForSave(next?: {
    defaultModel?: string;
    customModel?: string;
    effort?: ThinkingEffort;
  }) {
    const defaultModel = next?.defaultModel ?? selectedModel;
    const customModel = next?.customModel ?? custom;
    const effort = next?.effort ?? selectedEffort;
    if (canSaveDefaultModelChoice(defaultModel, customModel)) {
      return { defaultModel, customModel, effort };
    }
    return {
      defaultModel: settings?.defaultModel || CUSTOM_MODEL_SENTINEL,
      customModel: settings?.customModel ?? "",
      effort,
    };
  }

  function persist(input: {
    defaultModel?: string;
    customModel?: string;
    effort?: ThinkingEffort;
    keys?: ReturnType<typeof modelKeySavePayload>;
    clearDrafts?: boolean;
  }) {
    if (!settings) return persistTail.current;
    const choice = choiceForSave(input);
    const keys = input.keys ?? [];
    persistTail.current = persistTail.current.then(async () => {
      inflight.current += 1;
      setBusy(true);
      setError("");
      setSaved(false);
      try {
        const next = await client.models.save({
          defaultModel: choice.defaultModel || CUSTOM_MODEL_SENTINEL,
          customModel: choice.customModel,
          effort: choice.effort,
          keys,
        });
        queryClient.setQueryData(orpc.models.get.queryOptions().queryKey, next);
        await queryClient.invalidateQueries({ queryKey: orpc.me.key() });
        if (input.clearDrafts) setDrafts({});
        setSaved(true);
      } catch (caught) {
        setError(userFacingError(caught, "Could not save"));
      } finally {
        inflight.current -= 1;
        if (inflight.current === 0) setBusy(false);
      }
    });
    return persistTail.current;
  }

  function persistChoice(next: {
    defaultModel?: string;
    customModel?: string;
    effort?: ThinkingEffort;
  }) {
    const defaultModel = next.defaultModel ?? selectedModel;
    const customModel = next.customModel ?? custom;
    if (!canSaveDefaultModelChoice(defaultModel, customModel)) return;
    void persist(next);
  }

  function persistKeys() {
    const keys = modelKeySavePayload({
      drafts,
      accountId: cfAccount,
      gatewayId: cfGateway,
      savedAccountId: cf?.accountId,
      savedGatewayId: cf?.gatewayId,
      cloudflareConfigured: Boolean(cf?.configured),
    });
    if (keys.length === 0) return;
    void persist({ keys, clearDrafts: true });
  }

  async function clear(provider: ModelProvider) {
    if (!settings) return;
    if (
      !window.confirm(
        provider === OPENAI_CODEX_PROVIDER
          ? "Disconnect ChatGPT from this office?"
          : "Remove this key from the office?",
      )
    )
      return;
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
        <p className="hint set-lede">
          Every teammate uses this unless you override it on that bot.
        </p>
        <label className="field">
          <span>Model</span>
          <ModelField
            value={selectedModel}
            catalog={pickerItems}
            className="bg-card-2"
            onChange={(next) => {
              setDefaultModel(next);
              const meta = settings.catalog.find((item) => item.id === next);
              if (
                meta?.provider === OPENAI_CODEX_PROVIDER ||
                (meta && !meta.available)
              ) {
                setOpenKeys((current) => ({
                  ...current,
                  [meta.provider]: true,
                }));
              }
              persistChoice({ defaultModel: next });
            }}
          />
        </label>
        {isGroxbotRouterModel(selectedModel) ? null : (
          <>
            <label className="field">
              <span>Effort</span>
              <EffortField
                value={selectedEffort}
                className="bg-card-2"
                onChange={(next) => {
                  const value = parseThinkingEffort(next);
                  setEffort(value);
                  persistChoice({ effort: value });
                }}
              />
            </label>
            <p className="hint">How hard the model thinks. Off skips reasoning.</p>
          </>
        )}
        {selectedModel === CUSTOM_MODEL_SENTINEL ? (
          <label className="field">
            <span>Model id</span>
            <input
              value={custom}
              placeholder="openrouter/deepseek/deepseek-v4-flash"
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setCustomModel(e.target.value)}
              onBlur={() =>
                persistChoice({
                  defaultModel: CUSTOM_MODEL_SENTINEL,
                  customModel: custom,
                })
              }
            />
          </label>
        ) : null}
        {selectedCodexModel ? (
          <CodexSetupSteps
            connected={Boolean(
              settings.keys.find(
                (item) =>
                  item.provider === OPENAI_CODEX_PROVIDER && item.configured,
              ),
            )}
          />
        ) : null}
        {warning ? <p className="model-warn">{warning}</p> : null}
        {error ||
        busy ||
        saved ||
        (selectedModel === CUSTOM_MODEL_SENTINEL && !custom.trim()) ? (
          <p className="hint" aria-live="polite">
            {error
              ? error
              : busy
                ? "Saving…"
                : saved
                  ? "Saved."
                  : "Enter a model id. It saves when you leave the field."}
          </p>
        ) : null}
      </section>
      <section className="set-block">
        <p className="group-label">Provider keys</p>
        <p className="hint set-lede">
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
              <p className="provider-key-meta">
                Included models. Usage is on Usage & Billing.
              </p>
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
                    {provider === OPENAI_CODEX_PROVIDER ? (
                      selectedCodexModel ? (
                        <p className="hint">
                          Paste the whole{" "}
                          <code>~/.codex/auth.json</code> file. It saves
                          when you leave the box.
                        </p>
                      ) : (
                        <CodexSetupSteps
                          connected={Boolean(status?.configured)}
                        />
                      )
                    ) : (
                      <p className="hint">
                        {meta.hint}{" "}
                        <a href={meta.docsUrl} target="_blank" rel="noreferrer">
                          Get a key
                        </a>
                      </p>
                    )}
                    <label className="field">
                      <span className="sr-only">
                        {meta.label}{" "}
                        {provider === OPENAI_CODEX_PROVIDER
                          ? "auth.json"
                          : provider === CLOUDFLARE_PROVIDER
                            ? "API token"
                            : "API key"}
                      </span>
                      {provider === OPENAI_CODEX_PROVIDER ? (
                        <textarea
                          rows={8}
                          spellCheck={false}
                          autoComplete="off"
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
                          onBlur={() => persistKeys()}
                        />
                      ) : (
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
                          onBlur={() => persistKeys()}
                        />
                      )}
                    </label>
                    {provider === CLOUDFLARE_PROVIDER ? (
                      <>
                        <input
                          placeholder="32-character account id"
                          spellCheck={false}
                          autoComplete="off"
                          value={cfAccount}
                          onChange={(e) => setAccountId(e.target.value)}
                          onBlur={() => persistKeys()}
                        />
                        <input
                          placeholder={`AI Gateway id (${DEFAULT_AI_GATEWAY_ID})`}
                          spellCheck={false}
                          autoComplete="off"
                          value={cfGateway}
                          onChange={(e) => setGatewayId(e.target.value)}
                          onBlur={() => persistKeys()}
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
                        {provider === OPENAI_CODEX_PROVIDER
                          ? "Disconnect"
                          : "Remove key"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      {keysReady || error ? (
        <div className="set-models-foot">
          {error ? <p className="error">{error}</p> : null}
          {keysReady ? (
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => persistKeys()}
            >
              {busy ? "Saving…" : "Save keys"}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
