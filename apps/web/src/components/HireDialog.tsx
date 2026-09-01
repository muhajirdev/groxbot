import { useEffect, useState } from "react";
import { Button, Field, Input, ModalShell } from "../ui";

export function HireDialog(props: {
  open: boolean;
  onClose: () => void;
  onHire: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const ready = Boolean(name.trim());

  useEffect(() => {
    if (props.open) setName("");
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
          props.onHire(next);
        }}
      >
        <h2 className="m-0 text-lg font-semibold tracking-tight">New Bot</h2>
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            placeholder="Piper"
            maxLength={80}
            autoComplete="off"
            onValueChange={setName}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready}>
            Hire
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
