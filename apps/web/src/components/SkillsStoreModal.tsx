import {
  SKILLS_STORE_CATALOG,
  type SkillsStoreListing,
} from "@groxbot/contracts";
import { useEffect, useState } from "react";
import { userFacingError } from "../lib/errors";
import { skillImportSummary } from "../lib/knowledge-import";
import { client } from "../lib/rpc";
import {
  skillsStoreCards,
  skillsStoreCategories,
  skillsStoreTrustLabel,
} from "../lib/skills-store";
import { Button, ModalShell, cn } from "../ui";
import { CloseIcon, SearchIcon } from "./Icons";

const CATEGORIES = skillsStoreCategories(SKILLS_STORE_CATALOG);

/** Standalone skills store — office Marketplace Skills tab is the primary surface. */
export function SkillsStoreModal(props: {
  open: boolean;
  onClose: () => void;
  /** Switch to the paste-URL import form in Skills. */
  onPasteImport?: () => void;
  /** Called after a successful install with the first imported path. */
  onInstalled?: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setCategory(null);
    setBusyId(null);
    setError("");
    setNotice("");
  }, [props.open]);

  const cards = props.open ? skillsStoreCards({ query, category }) : [];

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
      const path = result.imported[0]?.path;
      if (path) props.onInstalled?.(path);
    } catch (caught: unknown) {
      setError(userFacingError(caught, "Could not install that skill"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModalShell
      open={props.open}
      wide
      className="h-[min(86vh,720px)]"
      onClose={props.onClose}
    >
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
        <div className="min-w-0 pr-3">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Skills store
          </h2>
          <p className="m-0 text-[12px] text-muted">
            Curated Agent Skills. Install into office knowledge — Pi sees them
            on the next turn.
          </p>
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

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-[18px] py-2">
        <label className="search-field compact min-w-[160px] flex-1">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a skill"
            autoComplete="off"
            aria-label="Find a skill"
          />
        </label>
        {props.onPasteImport ? (
          <Button
            className="px-3 py-1.5 text-[13px]"
            variant="ghost"
            type="button"
            onClick={() => {
              props.onClose();
              props.onPasteImport?.();
            }}
          >
            Paste import
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-line px-[18px] py-2">
        {CATEGORIES.map((label) => {
          const active =
            label === "All" ? category === null : category === label;
          return (
            <button
              key={label}
              type="button"
              className={cn("chip", active && "on")}
              onClick={() => setCategory(label === "All" ? null : label)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error || notice ? (
        <p
          className={cn(
            "m-0 border-b border-line px-[18px] py-2 text-[12px]",
            error ? "text-danger" : "text-muted",
          )}
          aria-live="polite"
        >
          {error || notice}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
        {cards.length === 0 ? (
          <p className="muted py-10 text-center">
            {query.trim()
              ? `No skills match “${query.trim()}”.`
              : "No skills in this category."}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
            {cards.map((item) => {
              const busy = busyId === item.id;
              return (
                <article
                  key={item.id}
                  className="flex items-start justify-between gap-2.5 rounded-[14px] bg-card-2 p-3"
                >
                  <div className="min-w-0">
                    <strong className="mb-1 block">{item.name}</strong>
                    <p className="muted m-0 text-xs">{item.blurb}</p>
                    <p className="muted m-0 mt-1.5 text-[11px]">
                      {skillsStoreTrustLabel(item.trust)} · {item.category}
                    </p>
                  </div>
                  <button
                    className="mini shrink-0"
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void install(item)}
                  >
                    {busy ? "…" : "Install"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
