import type { Bot } from "@groxbot/contracts";
import { useEffect, useMemo, useState } from "react";
import { isArchivedBot } from "../lib/session";
import { Button, Field, Input, ModalShell } from "../ui";

export function CreateRoomDialog(props: {
  open: boolean;
  bots: Bot[];
  onClose: () => void;
  onCreate: (input: { name: string; memberBotIds: string[] }) => void;
}) {
  const live = useMemo(
    () => props.bots.filter((bot) => !isArchivedBot(bot)),
    [props.bots],
  );
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const ready = Boolean(name.trim()) && selected.length > 0;

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setSelected(live.map((bot) => bot.id));
  }, [props.open, live]);

  return (
    <ModalShell
      open={props.open}
      className="w-[min(380px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = name.trim();
          if (!next || selected.length === 0) return;
          props.onCreate({ name: next, memberBotIds: selected });
        }}
      >
        <h2 className="m-0 text-lg font-semibold tracking-tight">New room</h2>
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            placeholder="Weekly sync"
            maxLength={80}
            autoComplete="off"
            onValueChange={setName}
          />
        </Field>
        <div className="grid gap-1.5">
          <div className="text-[12px] text-muted">Who’s at the table</div>
          {live.length === 0 ? (
            <p className="m-0 text-[13px] text-muted">Hire a teammate first.</p>
          ) : (
            live.map((bot) => {
              const on = selected.includes(bot.id);
              return (
                <label
                  key={bot.id}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      setSelected((current) =>
                        on
                          ? current.filter((id) => id !== bot.id)
                          : [...current, bot.id],
                      );
                    }}
                  />
                  <span>{bot.name}</span>
                </label>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready}>
            Create
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
