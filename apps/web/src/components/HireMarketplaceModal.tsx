import type { AvatarShape } from "@groxbot/contracts";
import {
  BOT_MARKETPLACE_CATALOG,
  hireFieldsFromTemplate,
  type BotMarketplaceTemplate,
} from "@groxbot/contracts";
import { useEffect, useState } from "react";
import {
  hireMarketplaceCards,
  hireMarketplaceCategories,
  marketplaceAvatar,
} from "../lib/hire-marketplace";
import { Button, Field, Input, ModalShell, cn } from "../ui";
import { AvatarMark } from "./Avatar";
import { CloseIcon, SearchIcon } from "./Icons";

export type HireMarketplaceInput = {
  name: string;
  visibility: "private" | "shared";
  title?: string;
  marketplaceId?: string;
  instructions?: string;
  description?: string;
  avatarColor?: string;
  avatarShape?: AvatarShape;
};

type View = "name" | "browse";

const CATEGORIES = hireMarketplaceCategories(BOT_MARKETPLACE_CATALOG);

function PrivateHireToggle(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
      <input
        type="checkbox"
        checked={props.checked}
        className="size-3.5"
        title="Only you. They can't join a shared room."
        onChange={(event) => props.onChange(event.target.checked)}
      />
      Private
    </label>
  );
}

export function HireMarketplaceModal(props: {
  open: boolean;
  onClose: () => void;
  onHire: (input: HireMarketplaceInput) => void;
}) {
  const [view, setView] = useState<View>("name");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setView("name");
    setQuery("");
    setCategory(null);
    setBrowseAll(false);
    setName("");
    setPriv(false);
  }, [props.open]);

  const searching = Boolean(query.trim() || category);
  const cards = props.open
    ? hireMarketplaceCards({
        catalog: BOT_MARKETPLACE_CATALOG,
        query,
        category,
        all: browseAll,
      })
    : [];
  const visibility = priv ? "private" : "shared";
  const customReady = Boolean(name.trim());

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

  return (
    <ModalShell
      open={props.open}
      wide={view === "browse"}
      className={
        view === "browse"
          ? "h-[min(72vh,560px)] w-[min(720px,calc(100%-32px))] rounded-[18px]"
          : "w-[min(340px,calc(100%-48px))] rounded-[18px] p-0"
      }
      onClose={props.onClose}
    >
      {view === "name" ? (
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
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold tracking-tight">
              Hire someone
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
          <p className="m-0 text-[13px] text-muted">
            Give them a name. They get a desk, a computer, and a thread with
            you.
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
          <Button
            className="w-full px-3 py-2 text-[13px]"
            type="submit"
            disabled={!customReady}
          >
            Hire
          </Button>
          <button
            className="m-0 justify-self-start border-0 bg-transparent p-0 text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline"
            type="button"
            onClick={() => setView("browse")}
          >
            Or pick a role
          </button>
          <PrivateHireToggle checked={priv} onChange={setPriv} />
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-3.5 py-3">
            <h2 className="m-0 text-[15px] font-semibold tracking-tight">
              Pick a role
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
          <div className="flex flex-wrap items-center gap-2 px-3.5 pb-3">
            <label className="search-field compact hire-role-search min-w-0 max-w-[240px] flex-1">
              <SearchIcon />
              <input
                value={query}
                autoComplete="off"
                spellCheck={false}
                placeholder="Filter"
                className="min-w-0"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <PrivateHireToggle checked={priv} onChange={setPriv} />
            {!searching ? (
              <button
                className="ml-auto m-0 border-0 bg-transparent p-0 text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline"
                type="button"
                onClick={() => {
                  setBrowseAll((open) => !open);
                  if (browseAll) setCategory(null);
                }}
              >
                {browseAll ? "Show a few" : "See all roles"}
              </button>
            ) : null}
          </div>
          {browseAll && !query.trim() ? (
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
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
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto px-2.5 pb-3">
            {cards.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {query.trim()
                  ? `Nothing matches “${query.trim()}”.`
                  : "Nothing in this category."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 min-[640px]:grid-cols-2">
                {cards.map((item) => {
                  const face = marketplaceAvatar(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-[12px] border-0 bg-card-2 px-3 py-2.5 text-left text-inherit hover:bg-hover"
                      onClick={() => hireTemplate(item)}
                    >
                      <AvatarMark
                        name={item.name}
                        color={face.color}
                        shape={face.shape}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
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
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}
