import type { Bot } from "@groxbot/contracts";
import {
  CUSTOM_MODEL_SENTINEL,
  modelUsesThinkingEffort,
  parseBotEffort,
  pickerCatalog,
  thinkingEffortLabel,
} from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { patchBot } from "../lib/collections";
import { userFacingError } from "../lib/errors";
import { AVATAR_COLORS, AVATAR_SHAPES } from "../lib/jobs";
import {
  buildHarnessExport,
  harnessExportFilename,
  liveHarnessSource,
  saveHarnessExport,
} from "../lib/office-harness-export";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { isPinnedBot } from "../lib/sidebar";
import { Button } from "../ui";
import { AvatarMark, ShapePicks } from "./Avatar";
import { EffortField } from "./EffortField";
import { CloseIcon } from "./Icons";
import { ModelField } from "./ModelField";

export function BotSettingsPane(props: {
  bot: Bot;
  pending?: boolean;
  onCollapse: () => void;
  onSaved: () => Promise<void>;
  onPin?: (bot: Bot) => void;
  onArchive?: (bot: Bot) => void;
  onDelete?: (botId: string) => void;
}) {
  const bot = props.bot;
  const pending = Boolean(props.pending);
  const [name, setName] = useState(bot.name);
  const [color, setColor] = useState(bot.avatarColor);
  const [shape, setShape] = useState(bot.avatarShape);
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(bot.model || bot.effort),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [modelNotice, setModelNotice] = useState("");
  const modelsQuery = useQuery(orpc.models.get.queryOptions());
  const pinned = isPinnedBot(bot);
  const fullCatalog = modelsQuery.data?.catalog ?? [];
  const catalog = pickerCatalog(
    fullCatalog,
    bot.model || modelsQuery.data?.defaultModelId || "",
  );
  const defaultLabel =
    fullCatalog.find((item) => item.id === modelsQuery.data?.defaultModelId)
      ?.label ?? "workspace default";
  const listed = fullCatalog.some((item) => item.id === bot.model);
  const [model, setModel] = useState(
    listed || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL,
  );
  const [customModel, setCustomModel] = useState(listed ? "" : bot.model);
  const [effort, setEffort] = useState(parseBotEffort(bot.effort));
  const inheritedModel = modelsQuery.data?.defaultModelId ?? "";
  const selectedRunModel =
    model === CUSTOM_MODEL_SENTINEL ? customModel : model || inheritedModel;
  const showEffort = modelUsesThinkingEffort(selectedRunModel);
  const queued = useRef<{
    name?: string;
    avatarColor?: string;
    avatarShape?: typeof shape;
    model?: string;
    effort?: ReturnType<typeof parseBotEffort>;
    compactOffice?: boolean;
  } | null>(null);

  useEffect(() => {
    const ids = modelsQuery.data?.catalog ?? [];
    const inCatalog = ids.some((item) => item.id === bot.model);
    setModel(inCatalog || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL);
    setCustomModel(inCatalog ? "" : bot.model);
    setEffort(parseBotEffort(bot.effort));
  }, [bot.effort, bot.model, modelsQuery.data]);

  async function save(patch: {
    name?: string;
    avatarColor?: string;
    avatarShape?: typeof shape;
    model?: string;
    effort?: ReturnType<typeof parseBotEffort>;
    compactOffice?: boolean;
  }) {
    if (pending) {
      queued.current = { ...queued.current, ...patch };
      patchBot(bot.id, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.avatarColor !== undefined
          ? { avatarColor: patch.avatarColor }
          : {}),
        ...(patch.avatarShape !== undefined
          ? { avatarShape: patch.avatarShape }
          : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.effort !== undefined ? { effort: patch.effort } : {}),
      });
      return;
    }
    await client.bots.update({
      botId: bot.id,
      ...patch,
    });
    await props.onSaved();
  }

  const onSavedRef = useRef(props.onSaved);
  onSavedRef.current = props.onSaved;

  useEffect(() => {
    if (pending) return;
    const patch = queued.current;
    if (!patch) return;
    queued.current = null;
    void client.bots
      .update({
        botId: bot.id,
        ...patch,
      })
      .then(() => onSavedRef.current());
  }, [pending, bot.id]);

  async function exportHarness() {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const bundle = await buildHarnessExport(
        bot,
        liveHarnessSource({
          list: (botId) => client.computer.list({ botId }),
          read: (botId, path) => client.computer.read({ botId, path }),
        }),
      );
      saveHarnessExport(bundle, harnessExportFilename(bot));
    } catch (caught) {
      setExportError(
        userFacingError(caught, "Could not export this conversation"),
      );
    } finally {
      setExporting(false);
    }
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
        <div className="bot-set-extra">
          <button
            className="text-btn"
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? "Hide advanced" : "Advanced"}
          </button>
          {advancedOpen ? (
            <div className="advanced">
              <label className="field">
                <span>Model</span>
                <ModelField
                  value={model}
                  catalog={catalog}
                  inherit={{ label: defaultLabel }}
                  onChange={(next) => {
                    setModel(next);
                    if (next === CUSTOM_MODEL_SENTINEL) {
                      setModelNotice("");
                      return;
                    }
                    setModelNotice("Desk compacted for the new model.");
                    void save({ model: next, compactOffice: true });
                  }}
                />
              </label>
              {showEffort ? (
                <label className="field">
                  <span>Effort</span>
                  <EffortField
                    value={effort}
                    inherit={{
                      label: thinkingEffortLabel(
                        modelsQuery.data?.effort ?? "off",
                      ),
                    }}
                    onChange={(next) => {
                      const value = parseBotEffort(next);
                      setEffort(value);
                      void save({ effort: value });
                    }}
                  />
                </label>
              ) : null}
              {model === CUSTOM_MODEL_SENTINEL ? (
                <label className="field">
                  <span>Model id</span>
                  <input
                    value={customModel}
                    placeholder="anthropic/claude-sonnet-4-6"
                    onChange={(e) => setCustomModel(e.target.value)}
                    onBlur={() => {
                      const next = customModel.trim();
                      if (!next || next === bot.model) return;
                      setModelNotice("Desk compacted for the new model.");
                      void save({ model: next, compactOffice: true });
                    }}
                  />
                </label>
              ) : null}
              {modelNotice ? (
                <p className="hint" aria-live="polite">
                  {modelNotice}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="bot-set-export">
            <button
              className="text-btn"
              type="button"
              disabled={exporting}
              onClick={() => void exportHarness()}
            >
              {exporting ? "Exporting…" : "Export conversation"}
            </button>
            <p className="muted m-0 text-[12px]">
              JSON dump of this desk — full log with tool calls, computer files,
              and routines.
            </p>
            {exportError ? (
              <p className="m-0 text-[13px] text-danger">{exportError}</p>
            ) : null}
          </div>
        </div>
        {!pending && (props.onPin || props.onArchive || props.onDelete) ? (
          <div className="set-divide grid gap-1">
            {props.onPin ? (
              <button
                className="text-btn"
                type="button"
                onClick={() => props.onPin?.(bot)}
              >
                {pinned ? "Unpin" : "Pin"}
              </button>
            ) : null}
            {props.onArchive ? (
              <button
                className="text-btn"
                type="button"
                onClick={() => props.onArchive?.(bot)}
              >
                {bot.archivedAt ? "Unarchive" : "Archive"}
              </button>
            ) : null}
            {props.onDelete ? (
              confirmDelete ? (
                <div className="grid gap-2 pt-1">
                  <p className="m-0 text-[13px] text-muted">
                    Delete {bot.name}? This cannot be undone.
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
                      onClick={() => {
                        setDeleting(true);
                        void Promise.resolve(props.onDelete?.(bot.id)).finally(
                          () => setDeleting(false),
                        );
                      }}
                    >
                      {deleting ? "Deleting…" : `Delete ${bot.name}`}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className="text-btn danger"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete teammate
                </button>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
