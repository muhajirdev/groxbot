import {
  BOT_MARKETPLACE_CATALOG,
  hireFieldsFromTemplate,
  SKILLS_STORE_CATALOG,
  type BotMarketplaceTemplate,
  type SkillsStoreListing,
} from "@groxbot/contracts";
import { useEffect, useMemo, useState } from "react";
import { userFacingError } from "../lib/errors";
import {
  hireMarketplaceCards,
  hireMarketplaceCategories,
  marketplaceAvatar,
} from "../lib/hire-marketplace";
import { skillImportSummary } from "../lib/knowledge-import";
import {
  type MarketplaceTab,
  marketplaceBrowseSections,
  marketplaceChipSplit,
  marketplaceSearchPlaceholder,
} from "../lib/marketplace";
import { client } from "../lib/rpc";
import {
  skillsStoreCategories,
  useSkillsStoreSearch,
} from "../lib/skills-store";
import { Button, Field, Input, ModalShell, cn } from "../ui";
import { AvatarMark } from "./Avatar";
import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  PlugIcon,
  SearchIcon,
  SkillsIcon,
} from "./Icons";
import type { HireMarketplaceInput } from "../lib/hire-marketplace";
import { PluginsModal } from "./PluginsModal";
import { SkillStoreDetailView } from "./SkillStoreDetailView";

export type { HireMarketplaceInput };

const TABS: {
  id: MarketplaceTab;
  label: string;
  Icon: typeof PlugIcon;
}[] = [
  { id: "plugins", label: "Plugins", Icon: PlugIcon },
  { id: "bots", label: "Bots", Icon: BotIcon },
  { id: "skills", label: "Skills", Icon: SkillsIcon },
];

export function MarketplaceModal(props: {
  open: boolean;
  tab: MarketplaceTab;
  onTabChange: (tab: MarketplaceTab) => void;
  onClose: () => void;
  botId?: string;
  meUserId?: string;
  onHire: (input: HireMarketplaceInput) => void;
  onPasteImport?: () => void;
  onInstalled?: (path: string) => void;
}) {
  return (
    <ModalShell
      open={props.open}
      wide
      className="market-modal h-[min(86vh,760px)] w-[min(920px,calc(100%-32px))] rounded-[20px] bg-card"
      onClose={props.onClose}
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-1.5">
        <h2 className="m-0 min-w-0 flex-1 text-[16px] font-semibold tracking-tight">
          Marketplace
        </h2>
        <div
          className="market-segment"
          role="tablist"
          aria-label="Marketplace section"
        >
          {TABS.map((tab) => {
            const on = props.tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={cn("market-segment-btn", on && "on")}
                onClick={() => props.onTabChange(tab.id)}
              >
                <tab.Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {props.tab === "plugins" ? (
        <PluginsModal
          open={props.open}
          embedded
          botId={props.botId}
          meUserId={props.meUserId}
          onClose={props.onClose}
        />
      ) : null}
      {props.tab === "bots" ? (
        <BotsMarketplacePane
          open={props.open}
          onHire={(input) => {
            props.onHire(input);
            props.onClose();
          }}
        />
      ) : null}
      {props.tab === "skills" ? (
        <SkillsMarketplacePane
          open={props.open}
          onPasteImport={props.onPasteImport}
          onInstalled={props.onInstalled}
        />
      ) : null}
    </ModalShell>
  );
}

function BotsMarketplacePane(props: {
  open: boolean;
  onHire: (input: HireMarketplaceInput) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setCategory(null);
    setFeaturedOnly(false);
    setExpandedCategory(null);
    setMoreOpen(false);
    setCreateOpen(false);
    setName("");
    setPriv(false);
  }, [props.open]);

  const categories = useMemo(
    () =>
      hireMarketplaceCategories(BOT_MARKETPLACE_CATALOG).filter(
        (label) => label !== "All",
      ),
    [],
  );
  const chipSplit = useMemo(() => marketplaceChipSplit(categories), [categories]);
  const featured = useMemo(
    () => BOT_MARKETPLACE_CATALOG.filter((row) => row.starter).slice(0, 4),
    [],
  );
  const visible = useMemo(
    () =>
      hireMarketplaceCards({
        catalog: BOT_MARKETPLACE_CATALOG,
        query,
        category: featuredOnly ? null : category,
        all: true,
      }),
    [category, featuredOnly, query],
  );
  const sections = useMemo(
    () =>
      marketplaceBrowseSections({
        items: visible,
        featured: featured.filter((item) =>
          visible.some((row) => row.id === item.id),
        ),
        category: featuredOnly ? null : category,
        featuredOnly,
        query,
        expandedCategory,
        preview: 2,
      }),
    [category, expandedCategory, featured, featuredOnly, query, visible],
  );

  const visibility = priv ? "private" : "shared";
  const showFeaturedRow =
    !query.trim() && !category && !featuredOnly && featured.length > 0;

  function hireTemplate(template: BotMarketplaceTemplate) {
    const fields = hireFieldsFromTemplate(template);
    const face = marketplaceAvatar(template.id);
    props.onHire({
      name: fields.name,
      title: fields.title,
      visibility,
      marketplaceId: fields.marketplaceId,
      instructions: fields.instructions,
      description: fields.description,
      avatarColor: face.color,
      avatarShape: face.shape,
    });
  }

  if (createOpen) {
    return (
      <form
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-[18px] py-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = name.trim();
          if (!next) return;
          props.onHire({ name: next, visibility });
        }}
      >
        <button
          type="button"
          className="m-0 w-fit border-0 bg-transparent p-0 text-[13px] text-muted hover:text-ink"
          onClick={() => setCreateOpen(false)}
        >
          ← Bots
        </button>
        <h3 className="m-0 text-[15px] font-semibold">Create your own</h3>
        <p className="m-0 text-[13px] text-muted">
          Give them a name. They get a desk, a computer, and a thread with you.
        </p>
        <Field label="Name" className="mb-0">
          <Input
            autoFocus
            value={name}
            placeholder="Piper"
            maxLength={80}
            autoComplete="off"
            onValueChange={setName}
          />
        </Field>
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={priv}
            className="size-3.5"
            onChange={(event) => setPriv(event.target.checked)}
          />
          Private
        </label>
        <Button
          className="w-full px-3 py-2 text-[13px]"
          type="submit"
          disabled={!name.trim()}
        >
          Hire
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2.5 px-[18px] pt-1 pb-0">
        {showFeaturedRow ? (
          <div>
            <p className="market-section-label mb-1.5">Featured</p>
            <div className="grid grid-cols-2 gap-1.5 min-[640px]:grid-cols-4">
              {featured.map((item) => {
                const face = marketplaceAvatar(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="market-feature-card"
                    onClick={() => hireTemplate(item)}
                  >
                    <AvatarMark
                      name={item.name}
                      color={face.color}
                      shape={face.shape}
                      size="md"
                    />
                    <span className="mt-2 line-clamp-2 text-[12px] leading-snug font-medium">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5">
          <label className="market-search min-w-0 flex-1">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={marketplaceSearchPlaceholder("bots")}
              autoComplete="off"
              aria-label="Search bots"
            />
          </label>
          <button
            type="button"
            className="m-0 shrink-0 border-0 bg-transparent p-0 text-[12px] text-muted hover:text-ink"
            onClick={() => setCreateOpen(true)}
          >
            Create your own
          </button>
        </div>
        <div className="market-chips">
          <button
            type="button"
            className={cn("chip", category === null && !featuredOnly && "on")}
            onClick={() => {
              setCategory(null);
              setFeaturedOnly(false);
              setExpandedCategory(null);
              setMoreOpen(false);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={cn("chip", featuredOnly && "on")}
            onClick={() => {
              setFeaturedOnly(true);
              setCategory(null);
              setExpandedCategory(null);
              setMoreOpen(false);
            }}
          >
            Team
          </button>
          {chipSplit.shown.map((label) => (
            <button
              key={label}
              type="button"
              className={cn("chip", category === label && "on")}
              onClick={() => {
                setCategory(label);
                setFeaturedOnly(false);
                setExpandedCategory(null);
                setMoreOpen(false);
              }}
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
                <div className="absolute top-[calc(100%+6px)] right-0 z-10 max-h-[240px] min-w-[160px] overflow-auto rounded-[12px] border border-line bg-card p-1 shadow-modal">
                  {chipSplit.more.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        "block w-full rounded-[8px] border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-hover",
                        category === label && "bg-hover",
                      )}
                      onClick={() => {
                        setCategory(label);
                        setFeaturedOnly(false);
                        setExpandedCategory(null);
                        setMoreOpen(false);
                      }}
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
      <div className="min-h-0 flex-1 overflow-auto px-[18px] pt-3 pb-4">
        {sections.length === 0 ? (
          <p className="muted py-10 text-center">
            {query.trim()
              ? `Nothing matches “${query.trim()}”.`
              : "Nothing in this category."}
          </p>
        ) : (
          sections.map((section) => {
            if (section.key === "featured" && showFeaturedRow) return null;
            return (
              <section key={section.key} className="market-section">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="market-section-label mb-0">
                    {section.key === "featured"
                      ? "Team"
                      : section.title}
                  </p>
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
                <div className="grid grid-cols-1 gap-0.5 min-[560px]:grid-cols-2">
                  {section.items.map((item) => {
                    const face = marketplaceAvatar(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-[12px] border-0 bg-transparent px-1 py-2 text-left text-inherit hover:bg-hover"
                        onClick={() => hireTemplate(item)}
                      >
                        <AvatarMark
                          name={item.name}
                          color={face.color}
                          shape={face.shape}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {item.name}
                          </span>
                          <span className="block truncate text-[12px] text-muted">
                            {item.blurb}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function SkillsMarketplacePane(props: {
  open: boolean;
  onPasteImport?: () => void;
  onInstalled?: (path: string) => void;
}) {
  const [selectedSkill, setSelectedSkill] = useState<SkillsStoreListing | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setSelectedSkill(null);
    setQuery("");
    setCategory(null);
    setFeaturedOnly(false);
    setExpandedCategory(null);
    setMoreOpen(false);
    setBusyId(null);
    setError("");
    setNotice("");
  }, [props.open]);

  const categories = useMemo(
    () => skillsStoreCategories(SKILLS_STORE_CATALOG).filter((label) => label !== "All"),
    [],
  );
  const chipSplit = useMemo(() => marketplaceChipSplit(categories), [categories]);
  const featured = useMemo(
    () =>
      SKILLS_STORE_CATALOG.filter(
        (row) => row.trust === "official" || row.trust === "trusted",
      ).slice(0, 4),
    [],
  );
  const featuredIds = useMemo(
    () => new Set(featured.map((row) => row.id)),
    [featured],
  );
  const { skills: visible, loading } = useSkillsStoreSearch({
    open: props.open,
    query,
    category,
    featuredOnly,
    featuredIds,
  });
  const sections = useMemo(
    () =>
      marketplaceBrowseSections({
        items: visible,
        featured: featured.filter((item) =>
          visible.some((row) => row.id === item.id),
        ),
        category: featuredOnly ? null : category,
        featuredOnly,
        query,
        expandedCategory,
      }),
    [category, expandedCategory, featured, featuredOnly, query, visible],
  );

  async function install(row: SkillsStoreListing) {
    if (busyId) return;
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      const result = await client.knowledge.importSkill({
        source: row.source,
      });
      const summary = skillImportSummary(result);
      if (result.imported.length === 0) {
        setError(summary);
        return;
      }
      setNotice(summary);
      setInstalledIds((prev) => new Set(prev).add(row.id));
      const path = result.imported[0]?.path;
      if (path) props.onInstalled?.(path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not install that skill"));
    } finally {
      setBusyId(null);
    }
  }

  if (selectedSkill) {
    return (
      <SkillStoreDetailView
        listing={selectedSkill}
        onBack={() => setSelectedSkill(null)}
        onInstall={install}
        busy={busyId === selectedSkill.id}
        installed={installedIds.has(selectedSkill.id)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2.5 px-[18px] pt-2 pb-0">
        <div className="flex items-center gap-2">
          <label className="market-search min-w-0 flex-1">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={marketplaceSearchPlaceholder("skills")}
              autoComplete="off"
              aria-label="Search skills"
            />
          </label>
          {props.onPasteImport ? (
            <button
              type="button"
              className="m-0 shrink-0 border-0 bg-transparent p-0 text-[12px] text-muted hover:text-ink"
              onClick={props.onPasteImport}
            >
              Paste import
            </button>
          ) : null}
        </div>
        {query.trim().length < 2 ? (
        <div className="market-chips">
          <button
            type="button"
            className={cn("chip", category === null && !featuredOnly && "on")}
            onClick={() => {
              setCategory(null);
              setFeaturedOnly(false);
              setExpandedCategory(null);
              setMoreOpen(false);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={cn("chip", featuredOnly && "on")}
            onClick={() => {
              setFeaturedOnly(true);
              setCategory(null);
              setExpandedCategory(null);
              setMoreOpen(false);
            }}
          >
            Featured
          </button>
          {chipSplit.shown.map((label) => (
            <button
              key={label}
              type="button"
              className={cn("chip", category === label && "on")}
              onClick={() => {
                setCategory(label);
                setFeaturedOnly(false);
                setExpandedCategory(null);
                setMoreOpen(false);
              }}
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
                <div className="absolute top-[calc(100%+6px)] right-0 z-10 max-h-[240px] min-w-[160px] overflow-auto rounded-[12px] border border-line bg-card p-1 shadow-modal">
                  {chipSplit.more.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        "block w-full rounded-[8px] border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-ink hover:bg-hover",
                        category === label && "bg-hover",
                      )}
                      onClick={() => {
                        setCategory(label);
                        setFeaturedOnly(false);
                        setExpandedCategory(null);
                        setMoreOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
      {error || notice || loading ? (
        <p
          className={cn(
            "m-0 shrink-0 border-b border-line px-[18px] py-2 text-[12px]",
            error ? "text-danger" : "text-muted",
          )}
          aria-live="polite"
        >
          {error || notice || (loading ? "Searching…" : "")}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto px-[18px] pt-3 pb-4">
        {sections.length === 0 ? (
          <p className="muted py-10 text-center">
            {loading
              ? "Searching…"
              : query.trim()
                ? `No skills match “${query.trim()}”.`
                : "No skills in this category."}
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.key} className="market-section">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="market-section-label">{section.title}</p>
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
              <div className="grid grid-cols-1 gap-1.5 min-[560px]:grid-cols-2">
                {section.items.map((item) => {
                  const added = installedIds.has(item.id);
                  const busy = busyId === item.id;
                  return (
                    <article
                      key={item.id}
                      className="flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-hover"
                      onClick={() => setSelectedSkill(item)}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-card-2 text-ink">
                        <SkillsIcon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-[14px] leading-tight">
                          {item.name}
                        </strong>
                        <p
                          className="muted m-0 line-clamp-1 text-[12px] leading-snug"
                          title={item.blurb}
                        >
                          {item.blurb}
                        </p>
                      </div>
                      {added ? (
                        <span className="market-added shrink-0">
                          <CheckIcon className="size-3.5 text-ok" />
                          Added
                        </span>
                      ) : (
                        <button
                          className="mini shrink-0"
                          type="button"
                          disabled={Boolean(busyId)}
                          onClick={(event) => {
                            event.stopPropagation();
                            void install(item);
                          }}
                        >
                          {busy ? "…" : "Add"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
