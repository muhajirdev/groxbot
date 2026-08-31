import type { Bot, GuestAgentKind } from "@groxbot/contracts";
import {
  CUSTOM_MODEL_SENTINEL,
  PROVIDER_ORDER,
  catalogGroupLabel,
  pickerCatalog,
} from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AVATAR_COLORS, AVATAR_SHAPES } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { readNotify, writeNotify } from "../lib/prefs";
import { client } from "../lib/rpc";
import { AvatarMark, ShapePicks } from "./Avatar";
import { CloseIcon } from "./Icons";

export function BotSettingsPane(props: {
  bot: Bot;
  onCollapse: () => void;
  onSaved: () => Promise<void>;
  onArchiveChange: (bot: Bot) => Promise<void>;
}) {
  const bot = props.bot;
  const [name, setName] = useState(bot.name);
  const [title, setTitle] = useState(bot.title);
  const [description, setDescription] = useState(bot.description);
  const [color, setColor] = useState(bot.avatarColor);
  const [shape, setShape] = useState(bot.avatarShape);
  const [notify, setNotify] = useState(() => readNotify(bot.id));
  const [advancedOpen, setAdvancedOpen] = useState(bot.guestKind !== "off");
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [issued, setIssued] = useState<{
    token: string;
    command: string;
    kind: string;
  } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const archived = Boolean(bot.archivedAt);
  const modelsQuery = useQuery(orpc.models.get.queryOptions());
  const fullCatalog = modelsQuery.data?.catalog ?? [];
  const catalog = pickerCatalog(
    fullCatalog,
    bot.model || modelsQuery.data?.defaultModelId || "",
  );
  const defaultLabel =
    fullCatalog.find(
      (item) => item.id === modelsQuery.data?.defaultModelId,
    )?.label ?? "workspace default";
  const listed = fullCatalog.some((item) => item.id === bot.model);
  const [model, setModel] = useState(
    listed || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL,
  );
  const [customModel, setCustomModel] = useState(listed ? "" : bot.model);

  useEffect(() => {
    const ids = modelsQuery.data?.catalog ?? [];
    const inCatalog = ids.some((item) => item.id === bot.model);
    setName(bot.name);
    setTitle(bot.title);
    setDescription(bot.description);
    setColor(bot.avatarColor);
    setShape(bot.avatarShape);
    setNotify(readNotify(bot.id));
    setModel(inCatalog || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL);
    setCustomModel(inCatalog ? "" : bot.model);
    setIssued(null);
    setGuestError("");
    setAdvancedOpen(bot.guestKind !== "off");
    setConfirmArchive(false);
    setArchiveError("");
  }, [bot, modelsQuery.data]);

  async function save(patch: {
    name?: string;
    title?: string;
    description?: string;
    avatarColor?: string;
    avatarShape?: typeof shape;
    model?: string;
  }) {
    await client.bots.update({
      botId: bot.id,
      ...patch,
      instructions: patch.description ?? description,
    });
    await props.onSaved();
  }

  return (
    <aside className="pane">
      <div className="pane-head drag">
        <span className="pane-title">Settings</span>
        <button
          className="icon-btn no-drag"
          type="button"
          aria-label="Close settings"
          onClick={props.onCollapse}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="pane-scroll">
        <div className="hero-avatar">
          <AvatarMark name={name} color={color} shape={shape} large />
        </div>
        <div className="swatches">
          {AVATAR_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              className={`swatch${color === value ? " on" : ""}`}
              style={{ background: value }}
              onClick={() => {
                setColor(value);
                void save({ avatarColor: value });
              }}
            />
          ))}
        </div>
        <ShapePicks
          color={color}
          value={shape}
          shapes={AVATAR_SHAPES}
          onChange={(next) => {
            setShape(next);
            void save({ avatarShape: next });
          }}
        />
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== bot.name)
                void save({ name: name.trim() });
            }}
          />
        </label>
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            placeholder="Describe what your Bot does"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== bot.title) void save({ title });
            }}
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            rows={4}
            value={description}
            placeholder="What this Bot is for"
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== bot.description) void save({ description });
            }}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <select
            value={model}
            onChange={(e) => {
              const next = e.target.value;
              setModel(next);
              if (next !== CUSTOM_MODEL_SENTINEL) void save({ model: next });
            }}
          >
            <option value="">Workspace default ({defaultLabel})</option>
            {PROVIDER_ORDER.filter((provider) =>
              catalog.some((item) => item.provider === provider),
            ).map((provider) => (
              <optgroup key={provider} label={catalogGroupLabel(provider)}>
                {catalog
                  .filter((item) => item.provider === provider)
                  .map((item) => (
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
        {model === CUSTOM_MODEL_SENTINEL ? (
          <label className="field">
            <span>Model id</span>
            <input
              value={customModel}
              placeholder="anthropic/claude-sonnet-4-6"
              onChange={(e) => setCustomModel(e.target.value)}
              onBlur={() => {
                const next = customModel.trim();
                if (next && next !== bot.model) void save({ model: next });
              }}
            />
          </label>
        ) : null}
        <section className="set-block">
          <p className="group-label">Notifications</p>
          <label className="toggle-row">
            <span>Get notified when this Bot finishes or needs input.</span>
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => {
                setNotify(e.target.checked);
                writeNotify(bot.id, e.target.checked);
              }}
            />
          </label>
        </section>
        <button
          className="text-btn"
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? "Hide advanced" : "Advanced"}
        </button>
        {advancedOpen ? (
          <div className="advanced">
            <p className="hint">
              Off by default. Hermes or OpenClaw connect outbound to this bot.
            </p>
            <div className="row">
              {(["hermes", "openclaw"] as GuestAgentKind[]).map((kind) => (
                <button
                  key={kind}
                  className={`chip${bot.guestKind === kind ? " on" : ""}`}
                  type="button"
                  disabled={guestBusy || archived}
                  onClick={() => {
                    setGuestBusy(true);
                    setGuestError("");
                    void client.guests
                      .enable({ botId: bot.id, kind })
                      .then((result) => {
                        setIssued({
                          token: result.token,
                          command: result.command,
                          kind,
                        });
                        return props.onSaved();
                      })
                      .catch((caught: unknown) =>
                        setGuestError(
                          caught instanceof Error
                            ? caught.message
                            : "Could not enable",
                        ),
                      )
                      .finally(() => setGuestBusy(false));
                  }}
                >
                  {kind}
                </button>
              ))}
              {bot.guestKind !== "off" ? (
                <button
                  className="mini"
                  type="button"
                  disabled={guestBusy || archived}
                  onClick={() => {
                    setGuestBusy(true);
                    setIssued(null);
                    void client.guests
                      .disable({ botId: bot.id })
                      .then(props.onSaved)
                      .catch((caught: unknown) =>
                        setGuestError(
                          caught instanceof Error
                            ? caught.message
                            : "Could not disable",
                        ),
                      )
                      .finally(() => setGuestBusy(false));
                  }}
                >
                  Turn off
                </button>
              ) : null}
            </div>
            {issued ? (
              <label className="field" style={{ marginTop: 12 }}>
                <span>Run this on the machine that has {issued.kind}</span>
                <textarea rows={3} readOnly value={issued.command} />
              </label>
            ) : null}
            {guestError ? <p className="error">{guestError}</p> : null}
          </div>
        ) : null}
        <section className="set-block">
          <p className="group-label">Archive</p>
          {archived ? (
            <>
              <p className="hint">
                Hidden from the sidebar. Unarchive to keep working with{" "}
                {bot.name}.
              </p>
              <button
                className="text-btn"
                type="button"
                disabled={archiveBusy}
                onClick={() => {
                  setArchiveBusy(true);
                  setArchiveError("");
                  void client.bots
                    .unarchive({ botId: bot.id })
                    .then(props.onArchiveChange)
                    .catch((caught: unknown) =>
                      setArchiveError(
                        caught instanceof Error
                          ? caught.message
                          : "Could not unarchive",
                      ),
                    )
                    .finally(() => setArchiveBusy(false));
                }}
              >
                Unarchive
              </button>
            </>
          ) : (
            <>
              <p className="hint">
                Hide this teammate from the sidebar and stop work. History
                stays; you can unarchive later.
              </p>
              {confirmArchive ? (
                <div className="row">
                  <button
                    className="text-btn danger"
                    type="button"
                    disabled={archiveBusy}
                    onClick={() => {
                      setArchiveBusy(true);
                      setArchiveError("");
                      void client.bots
                        .archive({ botId: bot.id })
                        .then(props.onArchiveChange)
                        .catch((caught: unknown) =>
                          setArchiveError(
                            caught instanceof Error
                              ? caught.message
                              : "Could not archive",
                          ),
                        )
                        .finally(() => setArchiveBusy(false));
                    }}
                  >
                    Archive {bot.name}
                  </button>
                  <button
                    className="text-btn"
                    type="button"
                    disabled={archiveBusy}
                    onClick={() => setConfirmArchive(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="text-btn"
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                >
                  Archive
                </button>
              )}
            </>
          )}
          {archiveError ? <p className="error">{archiveError}</p> : null}
        </section>
      </div>
    </aside>
  );
}
