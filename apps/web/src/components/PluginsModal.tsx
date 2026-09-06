import type {
  McpConnection,
  McpProbeResult,
  PluginConnection,
} from "@groxbot/contracts";
import { useLiveQuery } from "@tanstack/react-db";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { mcpCollection, pluginsCollection } from "../lib/collections";
import { userFacingError } from "../lib/errors";
import {
  catalogWithInstalledPlaceholders,
  connectorPluginCards,
  groupPluginAccounts,
  matchesMcpQuery,
  matchesPluginAccountQuery,
  mcpHostLabel,
  mcpProbeSummary,
  type PluginTab,
  pluginAccountDetail,
  pluginAuthBusyLabel,
  pluginAuthOpeningCopy,
  pluginCategoryLabels,
  pluginGridColumns,
  showsCustomMcpSearchCard,
  showsMcpAddForm,
  visiblePluginCards,
} from "../lib/plugin-modal";
import {
  featuredPluginCards,
  marketplaceBrowseSections,
  marketplaceChipSplit,
  marketplaceInstalledSummary,
} from "../lib/marketplace";
import {
  composioLogoUrl,
  type PluginCard,
  placeholderConnectorCard,
  pluginCatalogQueryOptions,
} from "../lib/plugins";
import { client } from "../lib/rpc";
import { cn, Field, Input, ModalShell } from "../ui";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PlugIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";

const PLUGIN_MESSAGE = "groxbot:plugin";
const MCP_MESSAGE = "groxbot:mcp";

type PluginBusy = {
  key: string;
  /** Set while Composio’s sign-in window is being prepared. */
  authName?: string;
};

function isBusy(busy: PluginBusy | null, key: string): boolean {
  return busy?.key === key;
}

function isOpeningAuth(busy: PluginBusy | null, key: string): boolean {
  return Boolean(busy?.authName) && busy?.key === key;
}

export function PluginsModal(props: {
  open: boolean;
  botId?: string;
  meUserId?: string;
  onClose: () => void;
  /** When true, render body only — MarketplaceModal owns the shell. */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<PluginTab>("browse");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const catalogQuery = useQuery(pluginCatalogQueryOptions());
  const [busy, setBusy] = useState<PluginBusy | null>(null);
  const [error, setError] = useState("");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpPrivate, setMcpPrivate] = useState(false);
  const [mcpFormOpen, setMcpFormOpen] = useState(false);
  const [probes, setProbes] = useState<Record<string, McpProbeResult>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const connectionsQuery = useLiveQuery((q) =>
    q.from({ plugin: pluginsCollection }),
  );
  const mcpQuery = useLiveQuery((q) => q.from({ mcp: mcpCollection }));
  const connections = connectionsQuery.data ?? [];
  const mcpServers = mcpQuery.data ?? [];
  const installedIds = useMemo(
    () => new Set(connections.map((row) => row.toolkit)),
    [connections],
  );
  const catalogNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of catalogQuery.data ?? []) map.set(item.id, item.name);
    return map;
  }, [catalogQuery.data]);

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

  useEffect(() => {
    if (!props.open) return;
    const el = listRef.current;
    if (!el) return;
    const sync = () => setColumns(pluginGridColumns(el.clientWidth));
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.open]);

  const catalog = useMemo(
    () =>
      connectorPluginCards(
        catalogWithInstalledPlaceholders(
          catalogQuery.data ?? [],
          installedIds,
        ),
      ),
    [catalogQuery.data, installedIds],
  );
  const visible = useMemo(
    () =>
      props.open ? visiblePluginCards(catalog, query, tab, installedIds) : [],
    [catalog, installedIds, props.open, query, tab],
  );
  const featured = useMemo(() => featuredPluginCards(catalog), [catalog]);
  const browseSections = useMemo(
    () =>
      marketplaceBrowseSections({
        items: visible,
        featured: featured.filter((item) =>
          visible.some((row) => row.id === item.id),
        ),
        category,
        featuredOnly,
        query,
        expandedCategory,
      }),
    [category, expandedCategory, featured, featuredOnly, query, visible],
  );
  const categoryLabels = useMemo(
    () => pluginCategoryLabels(catalog).filter((label) => label !== "All" && label !== "Featured"),
    [catalog],
  );
  const chipSplit = useMemo(
    () => marketplaceChipSplit(categoryLabels),
    [categoryLabels],
  );
  const mcpVisible = useMemo(
    () => mcpServers.filter((row) => matchesMcpQuery(row.name, row.url, query)),
    [mcpServers, query],
  );
  const pluginAccounts = useMemo(
    () =>
      connections.filter((row) =>
        matchesPluginAccountQuery(
          row,
          catalogNames.get(row.toolkit) ?? row.toolkit,
          query,
        ),
      ),
    [catalogNames, connections, query],
  );
  const pluginAccountGroups = useMemo(
    () =>
      groupPluginAccounts(
        pluginAccounts,
        (toolkit) => catalogNames.get(toolkit) ?? toolkit,
      ),
    [catalogNames, pluginAccounts],
  );
  const privateCount = useMemo(
    () => connections.filter((row) => row.visibility === "private").length,
    [connections],
  );
  const installedToolkitCount = installedIds.size;
  const installedLogos = useMemo(() => {
    const seen = new Set<string>();
    const logos: string[] = [];
    for (const row of connections) {
      if (seen.has(row.toolkit)) continue;
      seen.add(row.toolkit);
      logos.push(row.toolkit);
      if (logos.length >= 8) break;
    }
    return logos;
  }, [connections]);

  useEffect(() => {
    if (!props.open) return;
    setTab("browse");
    setQuery("");
    setCategory(null);
    setFeaturedOnly(false);
    setExpandedCategory(null);
    setMoreOpen(false);
    setError("");
    setMcpFormOpen(false);
  }, [props.open]);

  async function authenticate(id: string, name: string, busyKey = id) {
    setError("");
    setBusy({ key: busyKey, authName: name });
    try {
      const result = await client.plugins.connect({ id });
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

  async function addAccount(item: PluginCard) {
    if (item.kind !== "connector") return;
    setError("");
    setBusy({ key: item.id, authName: item.name });
    try {
      const row = await client.plugins.add({ toolkit: item.id });
      pluginsCollection.utils.writeUpsert(row);
      await authenticate(row.id, item.name, item.id);
    } catch (caught) {
      setError(userFacingError(caught, "Could not add plugin"));
      setBusy(null);
    }
  }

  async function removePluginAccount(id: string) {
    setError("");
    setBusy({ key: id });
    try {
      await client.plugins.remove({ id });
      pluginsCollection.utils.writeDelete([id]);
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove plugin"));
    } finally {
      setBusy(null);
    }
  }

  async function sharePluginAccount(row: PluginConnection) {
    const visibility = row.visibility === "shared" ? "private" : "shared";
    setError("");
    setBusy({ key: row.id });
    try {
      const next = await client.plugins.update({ id: row.id, visibility });
      pluginsCollection.utils.writeUpsert(next);
    } catch (caught) {
      setError(
        userFacingError(
          caught,
          visibility === "shared"
            ? "Could not share plugin"
            : "Could not make private",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function addRemoteMcp() {
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    if (!name || !url) return;
    setError("");
    setBusy({ key: "mcp-add", authName: name });
    try {
      const result = await client.mcp.add({
        ...(props.botId ? { botId: props.botId } : {}),
        name,
        url,
        visibility: mcpPrivate ? "private" : "shared",
      });
      mcpCollection.utils.writeUpsert(result.connection);
      setMcpName("");
      setMcpUrl("");
      setMcpPrivate(false);
      setMcpFormOpen(false);
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

  async function connectRemoteMcp(id: string, name: string) {
    setError("");
    setBusy({ key: id, authName: name });
    try {
      const result = await client.mcp.connect({
        id,
        ...(props.botId ? { botId: props.botId } : {}),
      });
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
    setBusy({ key: id });
    try {
      await client.mcp.remove({ id });
      mcpCollection.utils.writeDelete([id]);
      setProbes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (caught) {
      setError(userFacingError(caught, "Could not remove MCP"));
    } finally {
      setBusy(null);
    }
  }

  async function shareRemoteMcp(row: McpConnection) {
    const visibility = row.visibility === "shared" ? "private" : "shared";
    setError("");
    setBusy({ key: row.id });
    try {
      const next = await client.mcp.update({ id: row.id, visibility });
      mcpCollection.utils.writeUpsert(next);
    } catch (caught) {
      setError(
        userFacingError(
          caught,
          visibility === "shared"
            ? "Could not share MCP"
            : "Could not make private",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function probeRemoteMcp(id: string) {
    setError("");
    setBusy({ key: `probe:${id}` });
    try {
      const result = await client.mcp.probe({ id });
      setProbes((prev) => ({ ...prev, [id]: result }));
      void mcpCollection.utils.refetch();
    } catch (caught) {
      setError(userFacingError(caught, "Could not test MCP"));
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim();
  const catalogPending = catalogQuery.isPending && !catalogQuery.data;
  const mcpSearchCard = tab === "browse" && showsCustomMcpSearchCard(query);
  const mcpAddForm = showsMcpAddForm(query, mcpFormOpen, mcpVisible.length);
  const showMcpSection = tab === "installed" && (!q || mcpVisible.length > 0);
  const emptyBrowse =
    q.length > 0 &&
    tab === "browse" &&
    visible.length === 0 &&
    (catalogQuery.data?.length ?? 0) > 0 &&
    !mcpSearchCard;
  const emptyInstalled =
    tab === "installed" &&
    q.length > 0 &&
    pluginAccounts.length === 0 &&
    mcpVisible.length === 0;

  const allChipOn = category === null && !featuredOnly;
  const featuredChipOn = featuredOnly;

  function selectAllChip() {
    setCategory(null);
    setFeaturedOnly(false);
    setExpandedCategory(null);
    setMoreOpen(false);
  }

  function selectFeaturedChip() {
    setCategory(null);
    setFeaturedOnly(true);
    setExpandedCategory(null);
    setMoreOpen(false);
  }

  function selectCategoryChip(label: string) {
    setCategory(label);
    setFeaturedOnly(false);
    setExpandedCategory(null);
    setMoreOpen(false);
  }

  const body = (
    <>
      {props.embedded ? null : (
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Plugins
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
      )}
      {tab === "browse" ? (
        <div className="flex shrink-0 flex-col gap-2.5 px-[18px] pt-2 pb-1">
          <button
            type="button"
            className="market-installed-bar"
            onClick={() => {
              setTab("installed");
              setQuery("");
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex items-center -space-x-1.5">
                {installedLogos.length === 0 ? (
                  <span className="grid size-6 place-items-center rounded-full bg-hover text-muted">
                    <PlugIcon className="size-3.5" />
                  </span>
                ) : (
                  installedLogos.map((slug) => (
                    <span
                      key={slug}
                      className="grid size-6 place-items-center overflow-hidden rounded-full border border-card bg-white"
                    >
                      <img
                        alt=""
                        src={composioLogoUrl(slug)}
                        width={16}
                        height={16}
                        className="size-4 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  ))
                )}
              </span>
              <span className="truncate text-[13px] text-muted">
                {marketplaceInstalledSummary({
                  installed: installedToolkitCount,
                  privateCount,
                })}
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted" />
          </button>
          <label className="market-search">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins"
              autoComplete="off"
              aria-label="Search plugins"
            />
          </label>
          <div className="market-chips">
            <button
              type="button"
              className={cn("chip", allChipOn && "on")}
              onClick={selectAllChip}
            >
              All
            </button>
            <button
              type="button"
              className={cn("chip", featuredChipOn && "on")}
              onClick={selectFeaturedChip}
            >
              Featured
            </button>
            {chipSplit.shown.map((label) => (
              <button
                key={label}
                type="button"
                className={cn("chip", category === label && "on")}
                onClick={() => selectCategoryChip(label)}
              >
                {label}
              </button>
            ))}
            {chipSplit.more.length > 0 ? (
              <div className="relative shrink-0">
                <button
                  type="button"
                  className={cn(
                    "chip inline-flex items-center gap-1",
                    chipSplit.more.includes(category ?? "") && "on",
                  )}
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  More
                  <ChevronDownIcon className="size-3.5" />
                </button>
                {moreOpen ? (
                  <div className="absolute top-[calc(100%+6px)] right-0 z-10 max-h-[240px] min-w-[180px] overflow-auto rounded-[12px] border border-line bg-card p-1 shadow-modal">
                    {chipSplit.more.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={cn(
                          "block w-full rounded-[8px] border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-hover",
                          category === label && "bg-hover",
                        )}
                        onClick={() => selectCategoryChip(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-[18px] py-2">
          <button
            type="button"
            className="m-0 border-0 bg-transparent p-0 text-[13px] text-muted hover:text-ink"
            onClick={() => {
              setTab("browse");
              setQuery("");
            }}
          >
            ← Marketplace
          </button>
          <label className="market-search ml-auto max-w-[240px] flex-1">
            <SearchIcon />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search installed"
              autoComplete="off"
              aria-label="Search installed"
            />
          </label>
        </div>
      )}
      {error ? (
        <p
          className="m-0 shrink-0 border-b border-line px-[18px] py-2 text-[13px] text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div ref={listRef} className="min-h-0 flex-1 overflow-hidden">
        {emptyBrowse || emptyInstalled ? (
          <p className="muted py-10 text-center">
            No plugins match “{q}”.
          </p>
        ) : tab === "browse" ? (
          <div className="h-full overflow-auto px-[18px] pb-4">
            {mcpSearchCard ? (
              <div className="pt-2 pb-3">
                <CustomMcpSearchCard
                  onAdd={() => {
                    setQuery("");
                    setTab("installed");
                    setMcpFormOpen(true);
                  }}
                />
              </div>
            ) : null}
            {catalogPending ? (
              <PluginCatalogSkeleton columns={columns} />
            ) : catalogQuery.isError && !catalogQuery.data ? (
              <p className="muted py-10 text-center">
                Could not load the plugin catalog.
              </p>
            ) : browseSections.length === 0 ? (
              <p className="muted py-10 text-center">Nothing in this category.</p>
            ) : (
              browseSections.map((section) => (
                <section key={section.key} className="mb-5">
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <p className="group-label m-0">{section.title}</p>
                    {section.hasMore ? (
                      <button
                        type="button"
                        className="m-0 border-0 bg-transparent p-0 text-[12px] text-muted hover:text-ink"
                        onClick={() => setExpandedCategory(section.title)}
                      >
                        View all
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2">
                    {section.items.map((item) => (
                      <PluginToolkitCard
                        key={item.id}
                        item={item}
                        added={installedIds.has(item.id)}
                        busy={isBusy(busy, item.id)}
                        opening={isOpeningAuth(busy, item.id)}
                        onAdd={() => void addAccount(item)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        ) : (
          <div className="h-full overflow-auto px-[18px] py-4">
            {pluginAccountGroups.size === 0 && mcpVisible.length === 0 ? (
              <p className="muted mb-[18px]">
                Nothing connected yet. Add an app from Marketplace, or a custom
                MCP server below.
              </p>
            ) : null}
            {[...pluginAccountGroups.entries()].map(([name, rows]) => {
              const toolkit = rows[0]?.toolkit;
              return (
                <section key={name} className="mb-[18px]">
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="group-label m-0">{name}</p>
                      {toolkit ? (
                        <button
                          className="mini shrink-0 whitespace-nowrap"
                          type="button"
                          disabled={isBusy(busy, toolkit)}
                          onClick={() =>
                            void addAccount(
                              catalog.find((item) => item.id === toolkit) ??
                                placeholderConnectorCard(toolkit),
                            )
                          }
                        >
                          {isOpeningAuth(busy, toolkit)
                            ? pluginAuthBusyLabel()
                            : "Add another"}
                        </button>
                      ) : null}
                    </div>
                    {toolkit && isOpeningAuth(busy, toolkit) ? (
                      <PluginAuthStatus className="mt-1" name={name} />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {rows.map((row) => (
                      <PluginAccountCard
                        key={row.id}
                        row={row}
                        name={name}
                        busy={isBusy(busy, row.id)}
                        opening={isOpeningAuth(busy, row.id)}
                        mine={Boolean(
                          props.meUserId && row.userId === props.meUserId,
                        )}
                        onAuthenticate={() =>
                          void authenticate(row.id, name)
                        }
                        onShare={() => void sharePluginAccount(row)}
                        onRemove={() => void removePluginAccount(row.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            {showMcpSection ? (
              <section className="mb-[18px]">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="group-label m-0">Custom MCP</p>
                  {mcpVisible.length > 0 ? (
                    <button
                      className="mini shrink-0 whitespace-nowrap"
                      type="button"
                      onClick={() => setMcpFormOpen((open) => !open)}
                    >
                      {mcpAddForm ? "Cancel" : "Add server"}
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {mcpAddForm ? (
                    <McpAddForm
                      name={mcpName}
                      url={mcpUrl}
                      asPrivate={mcpPrivate}
                      busy={isBusy(busy, "mcp-add")}
                      opening={isOpeningAuth(busy, "mcp-add")}
                      onName={setMcpName}
                      onUrl={setMcpUrl}
                      onPrivate={setMcpPrivate}
                      onSubmit={() => void addRemoteMcp()}
                    />
                  ) : null}
                  {mcpVisible.map((row) => (
                    <McpServerCard
                      key={row.id}
                      row={row}
                      probe={probes[row.id]}
                      busy={isBusy(busy, row.id)}
                      opening={isOpeningAuth(busy, row.id)}
                      probing={isBusy(busy, `probe:${row.id}`)}
                      mine={Boolean(
                        props.meUserId && row.userId === props.meUserId,
                      )}
                      onConnect={() =>
                        void connectRemoteMcp(row.id, row.name)
                      }
                      onProbe={() => void probeRemoteMcp(row.id)}
                      onShare={() => void shareRemoteMcp(row)}
                      onRemove={() => void removeRemoteMcp(row.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </>
  );

  if (props.embedded) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
    );
  }

  return (
    <ModalShell
      open={props.open}
      wide
      className="h-[min(86vh,720px)]"
      onClose={props.onClose}
    >
      {body}
    </ModalShell>
  );
}

function PluginCatalogSkeleton(props: { columns: number }) {
  const cols = Math.max(1, props.columns);
  return (
    <div className="py-2" aria-busy="true" aria-label="Loading plugins">
      <p className="group-label mb-2">Apps</p>
      <div
        className="grid items-stretch gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols * 3 }, (_, index) => (
          <article
            key={index}
            className="flex min-h-[96px] gap-2.5 rounded-[14px] bg-card-2 p-3"
          >
            <span className="size-9 shrink-0 animate-pulse rounded-lg bg-hover" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <span className="h-3.5 w-2/3 animate-pulse rounded bg-hover" />
              <span className="h-2.5 w-full animate-pulse rounded bg-hover" />
              <span className="h-2.5 w-4/5 animate-pulse rounded bg-hover" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PluginToolkitCard(props: {
  item: PluginCard;
  added: boolean;
  busy: boolean;
  opening: boolean;
  onAdd: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-[14px] px-1 py-2">
      <PluginLogo slug={props.item.id} name={props.item.name} size="lg" />
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-[14px] leading-tight">
          {props.item.name}
        </strong>
        {props.opening ? (
          <PluginAuthStatus name={props.item.name} />
        ) : props.item.blurb ? (
          <p
            className="muted m-0 line-clamp-1 text-[12px] leading-snug"
            title={props.item.blurb}
          >
            {props.item.blurb}
          </p>
        ) : null}
      </div>
      {props.added && !props.opening ? (
        <span className="market-added shrink-0">
          <CheckIcon className="size-3.5 text-ok" />
          Added
        </span>
      ) : (
        <button
          className="mini shrink-0 whitespace-nowrap"
          type="button"
          disabled={props.busy}
          aria-busy={props.opening}
          onClick={props.onAdd}
        >
          {props.opening ? pluginAuthBusyLabel() : "Add"}
        </button>
      )}
    </article>
  );
}

function PluginAccountCard(props: {
  row: PluginConnection;
  name: string;
  busy: boolean;
  opening: boolean;
  mine: boolean;
  onAuthenticate: () => void;
  onShare: () => void;
  onRemove: () => void;
}) {
  const live = props.row.status === "connected";
  const detail = pluginAccountDetail(props.row);
  return (
    <article className="flex items-start gap-3 rounded-[14px] bg-card-2 p-3">
      <PluginLogo slug={props.row.toolkit} name={props.name} />
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[12rem]">
          <strong className="mb-0.5 block truncate">{props.name}</strong>
          {props.opening ? (
            <PluginAuthStatus name={props.name} />
          ) : (
            <p
              className={cn(
                "m-0 truncate text-xs",
                props.row.status === "error" ? "text-danger" : "muted",
              )}
            >
              {detail}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {live ? (
            <>
              <span className="ok">Connected</span>
              {props.mine ? (
                <button
                  className="mini"
                  type="button"
                  disabled={props.busy}
                  onClick={props.onShare}
                >
                  {props.row.visibility === "shared" ? "Make private" : "Share"}
                </button>
              ) : null}
            </>
          ) : (
            <button
              className="mini"
              type="button"
              disabled={props.busy}
              aria-busy={props.opening}
              onClick={props.onAuthenticate}
            >
              {props.opening
                ? pluginAuthBusyLabel()
                : props.row.status === "connecting"
                  ? "Continue"
                  : "Authenticate"}
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            aria-label={`Remove ${props.name}`}
            disabled={props.busy}
            onClick={props.onRemove}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function McpServerCard(props: {
  row: McpConnection;
  probe?: McpProbeResult;
  busy: boolean;
  opening: boolean;
  probing: boolean;
  mine: boolean;
  onConnect: () => void;
  onProbe: () => void;
  onShare: () => void;
  onRemove: () => void;
}) {
  const live = props.row.status === "connected";
  const host = mcpHostLabel(props.row.url);
  const scope = props.row.visibility === "private" ? "Private" : "Shared";
  const detail = props.probe
    ? mcpProbeSummary(props.probe, host)
    : props.row.status === "error" && props.row.lastError
      ? props.row.lastError
      : `${scope} · ${host}`;
  return (
    <article className="flex items-start gap-3 rounded-[14px] bg-card-2 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover text-ink">
        <PlugIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[12rem]">
          <strong className="mb-0.5 block truncate">{props.row.name}</strong>
          {props.opening ? (
            <PluginAuthStatus name={props.row.name} />
          ) : (
            <p
              className={cn(
                "m-0 truncate text-xs",
                props.probe && !props.probe.ok ? "text-danger" : "muted",
              )}
              title={props.row.url}
            >
              {detail}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {live ? (
            <>
              <span className="ok">Connected</span>
              <button
                className="mini"
                type="button"
                disabled={props.busy || props.probing}
                onClick={props.onProbe}
              >
                {props.probing ? "Testing…" : "Test"}
              </button>
              {props.mine ? (
                <button
                  className="mini"
                  type="button"
                  disabled={props.busy || props.probing}
                  onClick={props.onShare}
                >
                  {props.row.visibility === "shared" ? "Make private" : "Share"}
                </button>
              ) : null}
            </>
          ) : (
            <button
              className="mini"
              type="button"
              disabled={props.busy}
              aria-busy={props.opening}
              onClick={props.onConnect}
            >
              {props.opening
                ? pluginAuthBusyLabel()
                : props.row.status === "connecting"
                  ? "Continue"
                  : "Connect"}
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            aria-label={`Remove ${props.row.name}`}
            disabled={props.busy || props.probing}
            onClick={props.onRemove}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function CustomMcpSearchCard(props: { onAdd: () => void }) {
  return (
    <article className="flex items-start gap-3 rounded-[14px] bg-card-2 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover text-ink">
        <PlugIcon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[12rem]">
          <strong className="mb-0.5 block truncate">Custom MCP</strong>
          <p className="muted m-0 text-xs leading-snug">
            Connect a remote server by URL. Shared with the team unless you make
            it private.
          </p>
        </div>
        <button
          className="mini shrink-0 whitespace-nowrap"
          type="button"
          onClick={props.onAdd}
        >
          Add
        </button>
      </div>
    </article>
  );
}

function McpAddForm(props: {
  name: string;
  url: string;
  asPrivate: boolean;
  busy: boolean;
  opening: boolean;
  onName: (value: string) => void;
  onUrl: (value: string) => void;
  onPrivate: (value: boolean) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="grid gap-3 rounded-[14px] bg-card-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <p
        className="muted m-0 text-xs leading-snug"
        role={props.opening ? "status" : undefined}
        aria-live={props.opening ? "polite" : undefined}
      >
        {props.opening
          ? pluginAuthOpeningCopy(props.name)
          : "Paste the server URL. Name is what you’ll see on Installed."}
      </p>
      <Field label="Name" className="mb-0">
        <Input
          value={props.name}
          placeholder="Linear"
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
          inputMode="url"
          onValueChange={props.onUrl}
        />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex w-fit cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={props.asPrivate}
            className="size-3.5"
            onChange={(event) => props.onPrivate(event.target.checked)}
          />
          Only me — not shared with the team
        </label>
        <button
          className="mini disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={props.busy || !props.name.trim() || !props.url.trim()}
          aria-busy={props.opening}
        >
          {props.opening
            ? pluginAuthBusyLabel()
            : props.busy
              ? "Adding…"
              : "Add"}
        </button>
      </div>
    </form>
  );
}

function PluginAuthStatus(props: { name: string; className?: string }) {
  return (
    <p
      className={cn("m-0 text-xs leading-snug", props.className)}
      role="status"
      aria-live="polite"
    >
      {pluginAuthOpeningCopy(props.name)}
    </p>
  );
}

function PluginLogo(props: {
  slug: string;
  name: string;
  size?: "sm" | "lg";
}) {
  // logos.composio.dev has no CORS; never set crossOrigin.
  const large = props.size === "lg";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-[12px] bg-white",
        large ? "size-11" : "size-9 rounded-lg",
      )}
    >
      <img
        alt=""
        src={composioLogoUrl(props.slug)}
        width={large ? 28 : 24}
        height={large ? 28 : 24}
        loading="lazy"
        decoding="async"
        className={cn("object-contain", large ? "size-7" : "size-6")}
      />
    </span>
  );
}
