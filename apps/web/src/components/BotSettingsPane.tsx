import type { Bot } from "@groxbot/contracts";
import {
  CUSTOM_MODEL_SENTINEL,
  PROVIDER_ORDER,
  catalogGroupLabel,
  pickerCatalog,
} from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { patchBot } from "../lib/collections";
import { AVATAR_COLORS, AVATAR_SHAPES } from "../lib/jobs";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { AvatarMark, ShapePicks } from "./Avatar";
import { CloseIcon } from "./Icons";

export function BotSettingsPane(props: {
  bot: Bot;
  pending?: boolean;
  onCollapse: () => void;
  onSaved: () => Promise<void>;
}) {
  const bot = props.bot;
  const pending = Boolean(props.pending);
  const [name, setName] = useState(bot.name);
  const [color, setColor] = useState(bot.avatarColor);
  const [shape, setShape] = useState(bot.avatarShape);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(bot.model));
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
  const queued = useRef<
    | {
        name?: string;
        avatarColor?: string;
        avatarShape?: typeof shape;
        model?: string;
      }
    | null
  >(null);

  useEffect(() => {
    const ids = modelsQuery.data?.catalog ?? [];
    const inCatalog = ids.some((item) => item.id === bot.model);
    setModel(inCatalog || !bot.model ? bot.model : CUSTOM_MODEL_SENTINEL);
    setCustomModel(inCatalog ? "" : bot.model);
  }, [bot.model, modelsQuery.data]);

  async function save(patch: {
    name?: string;
    avatarColor?: string;
    avatarShape?: typeof shape;
    model?: string;
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
              <select
                value={model}
                onChange={(e) => {
                  const next = e.target.value;
                  setModel(next);
                  if (next !== CUSTOM_MODEL_SENTINEL)
                    void save({ model: next });
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
          </div>
        ) : null}
      </div>
    </aside>
  );
}
