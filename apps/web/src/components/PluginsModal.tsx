import type { McpConnection, PluginConnection } from "@groxbot/contracts";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useMemo, useState } from "react";
import { mcpCollection, pluginsCollection } from "../lib/collections";
import { userFacingError } from "../lib/errors";
import {
  groupVisiblePlugins,
  matchesMcpQuery,
  mcpHostLabel,
  type PluginTab,
  visiblePluginCards,
} from "../lib/plugin-modal";
import {
  composioLogoUrl,
  loadPluginCatalog,
  type PluginCard,
} from "../lib/plugins";
import { client } from "../lib/rpc";
import { cn, Field, Input, ModalShell } from "../ui";
import { CheckIcon, CloseIcon, PlugIcon, SearchIcon, TrashIcon } from "./Icons";

const PLUGIN_MESSAGE = "groxbot:plugin";
const MCP_MESSAGE = "groxbot:mcp";

export function PluginsModal(props: {
  open: boolean;
  botId?: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PluginTab>("search");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<PluginCard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const connectionsQuery = useLiveQuery((q) =>
    q.from({ plugin: pluginsCollection }),
  );
  const mcpQuery = useLiveQuery((q) => q.from({ mcp: mcpCollection }));
  const connections = connectionsQuery.data ?? [];
  const mcpServers = mcpQuery.data ?? [];
  const byToolkit = useMemo(() => {
    const map = new Map<string, PluginConnection>();
    for (const row of connections) map.set(row.toolkit, row);
    return map;
  }, [connections]);

  useEffect(() => {
    void loadPluginCatalog().then(setCatalog);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string } | null;
      if (data?.type === PLUGIN_MESSAGE) {
        void client.plugins.refresh().then((rows) => {
          pluginsCollection.utils.writeUpsert(rows);
        });
      }
      if (data?.type === MCP_MESSAGE) {
        void mcpCollection.utils.refetch();
      }
    }
    function onFocus() {
      void pluginsCollection.utils.refetch();
      void mcpCollection.utils.refetch();
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const visible = useMemo(
    () => visiblePluginCards(catalog, query, tab, new Set(byToolkit.keys())),
    [byToolkit, catalog, query, tab],
  );
  const mcpVisible = useMemo(
    () => mcpServers.filter((row) => matchesMcpQuery(row.name, row.url, query)),
    [mcpServers, query],
  );
  const groups = useMemo(
    () => groupVisiblePlugins(tab, visible, mcpVisible.length),
    [mcpVisible.length, tab, visible],
  );

  async function addOrRemove(item: PluginCard) {
    if (item.kind !== "connector") return;
    setError("");
    setBusy(item.id);
    try {
      if (byToolkit.has(item.id)) {
        await client.plugins.remove({ toolkit: item.id });
        const row = byToolkit.get(item.id);
        if (row) pluginsCollection.utils.writeDelete([row.id]);
      } else {
        const row = await client.plugins.add({ toolkit: item.id });
        pluginsCollection.utils.writeUpsert(row);
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not update plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function authenticate(item: PluginCard) {
    setError("");
    setBusy(item.id);
    try {
      const result = await client.plugins.connect({ toolkit: item.id });
      pluginsCollection.utils.writeUpsert(result.connection);
      if (result.redirectUrl) {
        window.open(
          result.redirectUrl,
          "groxbot-plugin",
          "popup,width=480,height=720",
        );
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not connect plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function addRemoteMcp() {
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    if (!name || !url) return;
    if (!props.botId) {
      setError("Open a teammate first, then connect this MCP.");
      return;
    }
    setError("");
    setBusy("mcp-add");
    try {
      const result = await client.mcp.add({
        botId: props.botId,
        name,
        url,
      });
      mcpCollection.utils.writeUpsert(result.connection);
      setMcpName("");
      setMcpUrl("");
      setAdvancedOpen(false);
      if (result.redirectUrl) {
        window.open(
          result.redirectUrl,
          "groxbot-mcp",
          "popup,width=480,height=720",
        );
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not add MCP"));
    } finally {
      setBusy(null);
    }
  }

  async function connectRemoteMcp(id: string) {
    if (!props.botId) {
      setError("Open a teammate first, then connect this MCP.");
      return;
    }
    setError("");
    setBusy(id);
    try {
      const result = await client.mcp.connect({ id, botId: props.botId });
      mcpCollection.utils.writeUpsert(result.connection);
      if (result.redirectUrl) {
        window.open(
          result.redirectUrl,
          "groxbot-mcp",
          "popup,width=480,height=720",
        );
      }
    } catch (caught) {
      setError(userFacingError(caught, "Could not connect MCP"));
    } finally {
      setBusy(null);
    }
  }

  async function removeRemoteMcp(id: string) {
    setError("");
    setBusy(id);
    try {
      await client.mcp.remove({ id });
      mcpCollection.utils.writeDelete([id]);
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove MCP"));
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim();
  const emptySearch =
    q.length > 0 &&
    visible.length === 0 &&
    (tab === "search" || mcpVisible.length === 0);

  return (
    <ModalShell open={props.open} wide onClose={props.onClose}>
      <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5">
        <h2 className="m-0 text-lg">Plugins</h2>
        <button
          className="icon-btn"
          type="button"
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex items-center gap-2 border-b border-line px-[18px]">
        <button
          className={cn("tab", tab === "search" && "on")}
          type="button"
          onClick={() => setTab("search")}
        >
          Search
        </button>
        <button
          className={cn("tab", tab === "installed" && "on")}
          type="button"
          onClick={() => setTab("installed")}
        >
          Installed
        </button>
        <div className="ml-auto flex items-center gap-2 text-muted">
          <label className="search-field compact">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins"
            />
          </label>
        </div>
      </div>
      {error ? (
        <p className="px-[18px] pt-3 text-[13px] text-danger">{error}</p>
      ) : null}
      <div className="min-h-[280px] max-h-[min(70vh,640px)] overflow-auto px-[18px] py-4">
        {emptySearch ? (
          <p className="muted py-10 text-center">No plugins match “{q}”.</p>
        ) : (
          <>
            {[...groups.entries()].map(([category, items]) => (
              <section key={category} className="mb-[18px]">
                <p className="group-label">{category}</p>
                {items.length === 0 ? (
                  <p className="muted">
                    Nothing here yet. Add a plugin from Search, then
                    authenticate.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                    {items.map((item) => {
                      const row = byToolkit.get(item.id);
                      const on = Boolean(row);
                      const live = row?.status === "connected";
                      return (
                        <article
                          key={item.id}
                          className="flex items-start justify-between gap-2.5 rounded-[14px] bg-card-2 p-3"
                        >
                          <div className="flex min-w-0 gap-2.5">
                            {item.kind === "connector" ? (
                              <PluginLogo
                                slug={item.id}
                                name={item.name}
                                src={item.logo}
                              />
                            ) : null}
                            <div className="min-w-0">
                              <strong className="mb-1 block">
                                {item.name}
                              </strong>
                              {tab === "installed" ? (
                                <p className="muted m-0 text-xs">
                                  1{" "}
                                  {item.kind === "skill"
                                    ? "skill"
                                    : "connector"}
                                  {row?.status === "error" && row.lastError
                                    ? ` · ${row.lastError}`
                                    : ""}
                                </p>
                              ) : (
                                <p className="muted m-0 text-xs">
                                  {item.blurb}
                                </p>
                              )}
                            </div>
                          </div>
                          {tab === "search" ? (
                            <button
                              className={cn("mini", on && "on")}
                              type="button"
                              disabled={
                                busy === item.id || item.kind !== "connector"
                              }
                              onClick={() => void addOrRemove(item)}
                            >
                              {on ? (
                                <>
                                  <CheckIcon /> Added
                                </>
                              ) : item.kind === "skill" ? (
                                "Soon"
                              ) : (
                                "Add"
                              )}
                            </button>
                          ) : item.kind === "connector" ? (
                            live ? (
                              <span className="ok">Connected</span>
                            ) : (
                              <button
                                className="mini"
                                type="button"
                                disabled={busy === item.id}
                                onClick={() => void authenticate(item)}
                              >
                                {row?.status === "connecting"
                                  ? "Continue"
                                  : "Authenticate"}
                              </button>
                            )
                          ) : (
                            <span className="muted">1 skill</span>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
            {tab === "installed" && mcpVisible.length > 0 ? (
              <section className="mb-[18px]">
                <p className="group-label">Custom MCP</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                  {mcpVisible.map((row) => (
                    <McpServerCard
                      key={row.id}
                      row={row}
                      busy={busy === row.id}
                      onConnect={() => void connectRemoteMcp(row.id)}
                      onRemove={() => void removeRemoteMcp(row.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {tab === "installed" && q.length === 0 ? (
              <AdvancedMcpForm
                open={advancedOpen}
                name={mcpName}
                url={mcpUrl}
                busy={busy === "mcp-add"}
                botId={props.botId}
                onToggle={() => setAdvancedOpen((open) => !open)}
                onName={setMcpName}
                onUrl={setMcpUrl}
                onSubmit={() => void addRemoteMcp()}
              />
            ) : null}
          </>
        )}
      </div>
    </ModalShell>
  );
}

function McpServerCard(props: {
  row: McpConnection;
  busy: boolean;
  onConnect: () => void;
  onRemove: () => void;
}) {
  const live = props.row.status === "connected";
  const host = mcpHostLabel(props.row.url);
  const detail =
    props.row.status === "error" && props.row.lastError
      ? props.row.lastError
      : host;
  return (
    <article className="flex items-center justify-between gap-2.5 rounded-[14px] bg-card-2 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover text-ink">
          <PlugIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <strong className="mb-0.5 block truncate">{props.row.name}</strong>
          <p className="muted m-0 truncate text-xs" title={props.row.url}>
            {detail}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {live ? (
          <span className="ok">Connected</span>
        ) : (
          <button
            className="mini"
            type="button"
            disabled={props.busy}
            onClick={props.onConnect}
          >
            {props.row.status === "connecting" ? "Continue" : "Connect"}
          </button>
        )}
        <button
          className="icon-btn"
          type="button"
          aria-label={`Remove ${props.row.name}`}
          disabled={props.busy}
          onClick={props.onRemove}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

function AdvancedMcpForm(props: {
  open: boolean;
  name: string;
  url: string;
  busy: boolean;
  botId?: string;
  onToggle: () => void;
  onName: (value: string) => void;
  onUrl: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section>
      <button className="text-btn" type="button" onClick={props.onToggle}>
        {props.open ? "Hide advanced" : "Advanced"}
      </button>
      {props.open ? (
        <form
          className="mt-2 grid gap-2 rounded-[14px] bg-card-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto]">
            <Field label="Name" className="mb-0">
              <Input
                value={props.name}
                placeholder="linear"
                maxLength={80}
                autoComplete="off"
                onValueChange={props.onName}
              />
            </Field>
            <Field label="URL" className="mb-0">
              <Input
                value={props.url}
                placeholder="https://mcp.example.com/mcp"
                maxLength={500}
                autoComplete="off"
                onValueChange={props.onUrl}
              />
            </Field>
            <div className="flex items-end">
              <button
                className="mini disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={props.busy || !props.name.trim() || !props.url.trim()}
              >
                {props.busy ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
          {!props.botId ? (
            <p className="muted m-0 text-xs">
              Open a teammate to finish connecting.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

function PluginLogo(props: { slug: string; name: string; src?: string }) {
  // logos.composio.dev has no CORS; never set crossOrigin.
  const src = props.src || composioLogoUrl(props.slug);
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white">
      <img alt="" src={src} className="size-6 object-contain" />
    </span>
  );
}
