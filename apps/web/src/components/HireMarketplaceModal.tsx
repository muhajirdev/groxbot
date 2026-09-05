import {
  BOT_MARKETPLACE_CATALOG,
  hireFieldsFromTemplate,
  type BotMarketplaceTemplate,
} from "@groxbot/contracts";
import { useEffect, useState } from "react";
import {
  hireMarketplaceCards,
  hireMarketplaceCategories,
} from "../lib/hire-marketplace";
import { Button, Field, Input, ModalShell, cn } from "../ui";
import { CloseIcon, SearchIcon } from "./Icons";

export type HireMarketplaceInput = {
  name: string;
  visibility: "private" | "shared";
  title?: string;
  marketplaceId?: string;
  instructions?: string;
  description?: string;
};

type View = "browse" | "custom";

const CATEGORIES = hireMarketplaceCategories(BOT_MARKETPLACE_CATALOG);

function PrivateHireToggle(props: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
      <input
        type="checkbox"
        checked={props.checked}
        className="size-3.5"
        title="Only you. Can't join a shared room."
        onChange={(event) => props.onChange(event.target.checked)}
      />
      {props.label}
    </label>
  );
}

export function HireMarketplaceModal(props: {
  open: boolean;
  onClose: () => void;
  onHire: (input: HireMarketplaceInput) => void;
}) {
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setView("browse");
    setQuery("");
    setCategory(null);
    setName("");
    setPriv(false);
  }, [props.open]);

  const cards = props.open
    ? hireMarketplaceCards({
        catalog: BOT_MARKETPLACE_CATALOG,
        query,
        category,
      })
    : [];
  const visibility = priv ? "private" : "shared";
  const customReady = Boolean(name.trim());

  function hireTemplate(template: BotMarketplaceTemplate) {
    const fields = hireFieldsFromTemplate(template);
    props.onHire({
      name: fields.name,
      title: fields.title,
      visibility,
      marketplaceId: fields.marketplaceId,
      instructions: fields.instructions,
      description: fields.description,
    });
  }

  return (
    <ModalShell
      open={props.open}
      wide
      className="h-[min(86vh,720px)]"
      onClose={props.onClose}
    >
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">
          {view === "custom" ? "Create your own" : "New bot"}
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

      {view === "browse" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-[18px] py-2">
            <label className="search-field compact min-w-[160px] flex-1">
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles"
                autoComplete="off"
              />
            </label>
            <Button
              className="px-3 py-1.5 text-[13px]"
              variant="ghost"
              type="button"
              onClick={() => setView("custom")}
            >
              Create your own
            </Button>
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
                  onClick={() =>
                    setCategory(label === "All" ? null : label)
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line px-[18px] py-2">
            <PrivateHireToggle
              checked={priv}
              label="Private hire"
              onChange={setPriv}
            />
            <p className="m-0 text-[12px] text-muted">
              Hire a teammate — not a plugin or skill.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
            {cards.length === 0 ? (
              <p className="muted py-10 text-center">
                {query.trim()
                  ? `No bots match “${query.trim()}”.`
                  : "No bots in this category."}
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
                {cards.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-start justify-between gap-2.5 rounded-[14px] bg-card-2 p-3"
                  >
                    <div className="min-w-0">
                      <strong className="mb-1 block">{item.name}</strong>
                      <p className="muted m-0 text-xs">{item.blurb}</p>
                      {item.kind === "person" && item.title ? (
                        <p className="muted m-0 mt-1 text-[11px]">
                          {item.title}
                        </p>
                      ) : null}
                      <p className="muted m-0 mt-1.5 text-[11px]">
                        Soul · memory
                        {item.skills.length
                          ? ` · ${item.skills.length} skill${item.skills.length === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                    <button
                      className="mini shrink-0"
                      type="button"
                      onClick={() => hireTemplate(item)}
                    >
                      Hire
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <form
          className="grid gap-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (!next) return;
            props.onHire({
              name: next,
              visibility,
            });
          }}
        >
          <p className="m-0 text-[13px] text-muted">
            Name a teammate. Their role grows in the office thread.
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
          <div className="flex items-center justify-between gap-2">
            <PrivateHireToggle
              checked={priv}
              label="Private"
              onChange={setPriv}
            />
            <div className="flex gap-2">
              <Button
                className="px-3 py-1.5 text-[13px]"
                variant="ghost"
                type="button"
                onClick={() => setView("browse")}
              >
                Back
              </Button>
              <Button
                className="px-3 py-1.5 text-[13px]"
                type="submit"
                disabled={!customReady}
              >
                Hire
              </Button>
            </div>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
