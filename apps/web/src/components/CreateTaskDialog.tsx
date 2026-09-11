import type { TaskStatus } from "@groxbot/core/browser";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button, Input, ModalShell, Textarea } from "../ui";

export function CreateTaskDialog(props: {
  open: boolean;
  status?: TaskStatus;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    body: string;
    status?: TaskStatus;
  }) => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const ready = Boolean(title.trim());

  useEffect(() => {
    if (!props.open) return;
    setTitle("");
    setBody("");
  }, [props.open]);

  return (
    <ModalShell
      open={props.open}
      className="w-[min(520px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <form
        className="grid gap-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const next = title.trim();
          if (!next) return;
          props.onCreate({
            title: next,
            body: body.trim(),
            status: props.status,
          });
        }}
      >
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">
          New task
        </h2>
        <Input
          id={titleId}
          autoFocus
          value={title}
          placeholder="Task title"
          maxLength={200}
          autoComplete="off"
          aria-label="Title"
          className="border-0 bg-transparent px-0 py-1 text-[17px] font-semibold tracking-tight focus-visible:border-0"
          onValueChange={setTitle}
        />
        <Textarea
          value={body}
          placeholder="Add notes…"
          maxLength={8000}
          rows={5}
          aria-label="Notes"
          className="min-h-[120px] border-0 bg-transparent px-0 py-1"
          onChange={(event) => setBody(event.target.value)}
        />
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
            Create
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
