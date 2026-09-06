import { useEffect, useState } from "react";
import type { HireMarketplaceInput } from "../lib/hire-marketplace";
import { Button, Field, Input, ModalShell } from "../ui";
import { CloseIcon } from "./Icons";

export type { HireMarketplaceInput };

export function HireMarketplaceModal(props: {
  open: boolean;
  onClose: () => void;
  onHire: (input: HireMarketplaceInput) => void;
}) {
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setPriv(false);
  }, [props.open]);

  const visibility = priv ? "private" : "shared";
  const ready = Boolean(name.trim());

  return (
    <ModalShell
      open={props.open}
      className="w-[min(340px,calc(100%-48px))] rounded-[18px] p-0"
      onClose={props.onClose}
    >
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
        <Button
          className="w-full px-3 py-2 text-[13px]"
          type="submit"
          disabled={!ready}
        >
          Hire
        </Button>
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={priv}
            className="size-3.5"
            title="Only you. They can't join a shared room."
            onChange={(event) => setPriv(event.target.checked)}
          />
          Private
        </label>
      </form>
    </ModalShell>
  );
}
