import { useEffect, useState } from "react";
import { Button, Field, Input, ModalShell } from "../ui";

export function CreateWorkspaceDialog(props: {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const ready = Boolean(name.trim()) && !props.busy;

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
          if (!next || props.busy) return;
          props.onCreate(next);
        }}
      >
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">
          Create workspace
        </h2>
        <Field label="Workspace name" className="mb-0">
          <Input
            autoFocus
            value={name}
            placeholder="Acme"
            maxLength={80}
            autoComplete="organization"
            onValueChange={setName}
          />
        </Field>
        {props.error ? (
          <p className="m-0 text-[12px] text-danger" role="alert">
            {props.error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            className="px-3 py-1.5 text-[13px]"
            variant="ghost"
            type="button"
            onClick={props.onClose}
          >
            Cancel
          </Button>
          <Button
            className="px-3 py-1.5 text-[13px]"
            type="submit"
            disabled={!ready}
          >
            {props.busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
