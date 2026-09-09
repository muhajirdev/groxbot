import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { userFacingError } from "../lib/errors";
import { useIconPress } from "../lib/icon-press";
import { orpc, queryClient } from "../lib/orpc";
import { client } from "../lib/rpc";
import { copyAndToast, toast, TOAST_INVITE_LINK_COPIED } from "../lib/toast";
import { Button, Field, Input, ModalShell } from "../ui";
import { PeoplePlusIcon } from "./Icons";

export function InviteFriendButton(props: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"create" | "delete" | null>(null);
  const [error, setError] = useState("");
  const press = useIconPress();

  const linkQuery = useQuery({
    ...orpc.workspaces.inviteLink.queryOptions(),
    queryKey: [...orpc.workspaces.inviteLink.key(), props.workspaceId],
    enabled: open,
  });
  const url = linkQuery.data?.url ?? null;
  const loading = linkQuery.isPending && linkQuery.data === undefined;
  const loadError = linkQuery.error
    ? userFacingError(linkQuery.error, "Could not load the invite link")
    : "";

  function close() {
    setOpen(false);
    setError("");
    setBusy(null);
  }

  async function createLink() {
    if (busy) return;
    setBusy("create");
    setError("");
    try {
      const next = await client.workspaces.createInviteLink();
      queryClient.setQueryData(
        [...orpc.workspaces.inviteLink.key(), props.workspaceId],
        next,
      );
    } catch (caught) {
      setError(userFacingError(caught, "Could not create an invite link"));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!url) return;
    const copied = await copyAndToast(url, TOAST_INVITE_LINK_COPIED);
    if (!copied) toast(url);
  }

  async function deleteLink() {
    if (busy) return;
    setBusy("delete");
    setError("");
    try {
      await client.workspaces.deleteInviteLink();
      queryClient.setQueryData(
        [...orpc.workspaces.inviteLink.key(), props.workspaceId],
        { url: null },
      );
    } catch (caught) {
      setError(userFacingError(caught, "Could not delete the invite link"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        className="ico-hit no-drag grid size-7 place-items-center rounded-lg border-0 bg-transparent text-muted outline-none transition-[background-color,color] duration-[var(--dur-popover)] ease-[var(--ease-dialog)] hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        type="button"
        aria-label="Invite a friend"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        {...press}
      >
        <PeoplePlusIcon />
      </button>
      <ModalShell
        open={open}
        className="w-[min(380px,calc(100%-48px))] p-4"
        onClose={close}
      >
        <div className="grid gap-3.5">
          <div className="grid gap-1.5">
            <h2 className="m-0 text-[15px] font-semibold tracking-tight">
              Invite friends
            </h2>
            <p className="m-0 text-[12px] leading-5 text-muted">
              Anyone with this link can join this workspace. Delete it to stop
              new joins.
            </p>
          </div>
          {loading ? (
            <p className="m-0 text-[13px] text-muted">Loading…</p>
          ) : url ? (
            <>
              <Field label="Invite link" className="mb-0">
                <Input
                  readOnly
                  value={url}
                  aria-label="Invite link"
                  className="bg-bg text-[13px]"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </Field>
              <div className="flex items-center justify-between gap-3">
                <Button
                  className="text-danger hover:text-danger"
                  variant="text"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void deleteLink()}
                >
                  {busy === "delete" ? "Deleting…" : "Delete"}
                </Button>
                <Button
                  className="px-3 py-1.5 text-[13px] font-semibold tracking-tight"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void copyLink()}
                >
                  Copy link
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <Button
                className="px-3 py-1.5 text-[13px] font-semibold tracking-tight"
                type="button"
                disabled={busy !== null}
                onClick={() => void createLink()}
              >
                {busy === "create" ? "Creating…" : "Create link"}
              </Button>
            </div>
          )}
          {error || loadError ? (
            <p className="m-0 text-[12px] text-danger" role="alert">
              {error || loadError}
            </p>
          ) : null}
        </div>
      </ModalShell>
    </>
  );
}
