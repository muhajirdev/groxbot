import { useEffect, useState } from "react";
import { Button, Field, Input, ModalShell } from "../ui";

export function HireDialog(props: {
  open: boolean;
  onClose: () => void;
  onHire: (input: { name: string; visibility: "private" | "shared" }) => void;
}) {
  const [name, setName] = useState("");
  const [priv, setPriv] = useState(false);
  const ready = Boolean(name.trim());

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setPriv(false);
  }, [props.open]);

  return (
    <ModalShell
      open={props.open}
      className="w-[min(340px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = name.trim();
          if (!next) return;
          props.onHire({
            name: next,
            visibility: priv ? "private" : "shared",
          });
        }}
      >
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">New Bot</h2>
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
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={priv}
              className="size-3.5"
              title="Only you. Can't join a shared room."
              onChange={(event) => setPriv(event.target.checked)}
            />
            Private
          </label>
          <div className="flex gap-2">
            <Button
              className="px-3 py-1.5 text-[13px]"
              variant="ghost"
              type="button"
              onClick={props.onClose}
            >
              Cancel
            </Button>
            <Button className="px-3 py-1.5 text-[13px]" type="submit" disabled={!ready}>
              Hire
            </Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
