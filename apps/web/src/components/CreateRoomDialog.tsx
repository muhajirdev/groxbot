import { Combobox } from "@base-ui/react/combobox";
import type { Bot } from "@groxbot/contracts";
import { isSharedVisibility } from "@groxbot/core/browser";
import { useEffect, useId, useMemo, useState } from "react";
import { isArchivedBot } from "../lib/session";
import { Button, Field, Input, ModalShell, cn } from "../ui";
import { AvatarMark } from "./Avatar";
import { CheckIcon, CloseIcon } from "./Icons";

function sameBot(a: Bot, b: Bot) {
  return a.id === b.id;
}

function InviteField(props: {
  id: string;
  bots: Bot[];
  invited: Bot[];
  onInvited: (next: Bot[]) => void;
}) {
  return (
    <Combobox.Root
      multiple
      autoHighlight
      autoComplete="off"
      items={props.bots}
      value={props.invited}
      onValueChange={props.onInvited}
      isItemEqualToValue={sameBot}
      itemToStringLabel={(bot) => bot.name}
      onOpenChange={(open, eventDetails) => {
        if (!open && eventDetails.reason === "item-press") {
          eventDetails.cancel();
        }
      }}
    >
      <Combobox.InputGroup
        className={cn(
          "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-lg border border-line bg-card px-2 py-1",
          "focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40",
        )}
      >
        <Combobox.Value>
          {(value: Bot[]) => (
            <Combobox.Chips
              className="flex w-full flex-wrap items-center gap-1"
              aria-label={value.length > 0 ? "Invited teammates" : undefined}
            >
                  {value.map((bot) => (
                    <Combobox.Chip
                      key={bot.id}
                      className="flex max-w-full items-center gap-1 rounded-pill border border-line bg-card-2 py-0.5 pr-0.5 pl-1.5 text-[13px] text-ink outline-none"
                      aria-label={bot.name}
                    >
                      <span className="min-w-0 truncate">{bot.name}</span>
                      <Combobox.ChipRemove
                        type="button"
                        className="grid size-5 shrink-0 place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:bg-hover hover:text-ink"
                        aria-label={`Remove ${bot.name}`}
                      >
                        <CloseIcon className="size-3" />
                      </Combobox.ChipRemove>
                    </Combobox.Chip>
                  ))}
              <Combobox.Input
                id={props.id}
                placeholder={
                  value.length > 0 ? "Add another…" : "Search teammates"
                }
                className="min-w-24 flex-1 border-0 bg-transparent p-1 text-[13px] text-ink outline-none placeholder:text-muted"
              />
            </Combobox.Chips>
          )}
        </Combobox.Value>
      </Combobox.InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner
                  className="z-50 outline-none"
                  side="bottom"
                  sideOffset={4}
                  align="start"
                >
                  <Combobox.Popup className="popover-popup max-h-[min(240px,var(--available-height))] w-[var(--anchor-width)] overflow-auto rounded-[10px] border border-line bg-card py-1 outline-none">
                    <Combobox.Empty>
                      <div className="px-3 py-2 text-[13px] text-muted">
                        No teammates match.
                      </div>
                    </Combobox.Empty>
                    <Combobox.List>
                      {(bot: Bot) => (
                        <Combobox.Item
                          key={bot.id}
                          value={bot}
                          className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[13px] text-ink outline-none select-none data-highlighted:bg-hover"
                        >
                          <AvatarMark
                            name={bot.name}
                            color={bot.avatarColor}
                            shape={bot.avatarShape}
                            size="xs"
                          />
                          <span className="min-w-0 flex-1 truncate">{bot.name}</span>
                          <Combobox.ItemIndicator className="text-muted">
                            <CheckIcon className="size-3.5" />
                          </Combobox.ItemIndicator>
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
    </Combobox.Root>
  );
}

export function CreateRoomDialog(props: {
  open: boolean;
  bots: Bot[];
  onClose: () => void;
  onCreate: (input: { name: string; memberBotIds: string[] }) => void;
}) {
  const live = useMemo(
    () =>
      props.bots.filter(
        (bot) => !isArchivedBot(bot) && isSharedVisibility(bot.visibility),
      ),
    [props.bots],
  );
  const inviteId = useId();
  const [name, setName] = useState("");
  const [invited, setInvited] = useState<Bot[]>([]);
  const ready = Boolean(name.trim()) && invited.length > 0;

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setInvited([]);
  }, [props.open]);

  return (
    <ModalShell
      open={props.open}
      className="w-[min(400px,calc(100%-48px))] p-4"
      onClose={props.onClose}
    >
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = name.trim();
          if (!next || invited.length === 0) return;
          props.onCreate({
            name: next,
            memberBotIds: invited.map((bot) => bot.id),
          });
        }}
      >
        <h2 className="m-0 text-[15px] font-semibold tracking-tight">New room</h2>
        <Field label="Name" className="mb-0">
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
          <label htmlFor={inviteId} className="text-xs text-muted">
            Invite
          </label>
          {live.length === 0 ? (
            <p className="m-0 text-[13px] text-muted">
              Share a teammate with the office before you make a group.
            </p>
          ) : (
            <InviteField
              id={inviteId}
              bots={live}
              invited={invited}
              onInvited={setInvited}
            />
          )}
        </div>
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
