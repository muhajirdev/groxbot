import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { userFacingError } from "../lib/errors";
import { orpc, queryClient } from "../lib/orpc";
import { client } from "../lib/rpc";
import { copyAndToast, TOAST_INVITE_LINK_COPIED, toast } from "../lib/toast";
import { Button, Field, Input, ModalShell } from "../ui";

export function InvitePeopleDialog(props: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "create" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);

  const linkQuery = useQuery({
    ...orpc.workspaces.inviteLink.queryOptions(),
    queryKey: [...orpc.workspaces.inviteLink.key(), props.workspaceId],
    enabled: props.open,
  });
  const url = linkQuery.data?.url ?? null;
  const loading = linkQuery.isPending && linkQuery.data === undefined;
  const loadError = linkQuery.error
    ? userFacingError(linkQuery.error, "Could not load the invite link")
    : "";

  useEffect(() => {
    if (props.open) return;
    setEmail("");
    setError("");
    setBusy(null);
    setSent(null);
  }, [props.open]);

  async function sendEmail() {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy("email");
    setError("");
    try {
      const invite = await client.workspaces.invite({ email: trimmed });
      setSent({ email: invite.email, url: invite.url });
      setEmail("");
    } catch (caught) {
      setError(userFacingError(caught, "Could not send invite"));
    } finally {
      setBusy(null);
    }
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

  async function copyUrl(value: string) {
    const copied = await copyAndToast(value, TOAST_INVITE_LINK_COPIED);
    if (!copied) toast(value);
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
    <ModalShell
      open={props.open}
      className="w-[min(380px,calc(100%-32px))] p-4"
      onClose={props.onClose}
    >
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <h2 className="m-0 text-[15px] font-semibold tracking-tight">
            Invite people
          </h2>
          <p className="m-0 text-[12px] leading-5 text-muted">
            Email a teammate or share a link. They join this workspace.
          </p>
        </div>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendEmail();
          }}
        >
          <Field label="Invite by email" className="mb-0">
            <Input
              type="email"
              value={email}
              placeholder="teammate@company.com"
              autoComplete="off"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              onValueChange={(value) => {
                setEmail(value);
                setError("");
              }}
            />
          </Field>
          <div className="flex justify-end">
            <Button
              className="px-3 py-1.5 text-[13px] font-semibold tracking-tight"
              type="submit"
              disabled={busy !== null || !email.trim()}
            >
              {busy === "email" ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
        {sent ? (
          <div className="grid gap-2">
            <p className="m-0 text-[12px] leading-5 text-muted">
              Invite emailed to {sent.email}. They open the link and join.
            </p>
            <Field label="Invite URL" className="mb-0">
              <Input
                readOnly
                value={sent.url}
                aria-label="Emailed invite URL"
                className="bg-bg text-[13px]"
                onFocus={(event) => event.currentTarget.select()}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                className="px-3 py-1.5 text-[13px] font-semibold tracking-tight"
                type="button"
                onClick={() => void copyUrl(sent.url)}
              >
                Copy link
              </Button>
            </div>
          </div>
        ) : null}
        <div className="border-t border-line" />
        <div className="grid gap-2">
          <p className="m-0 text-[12px] leading-5 text-muted">
            Anyone with this link can join this workspace. Delete it to stop new
            joins.
          </p>
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
                  onClick={() => void copyUrl(url)}
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
        </div>
        {error || loadError ? (
          <p className="m-0 text-[12px] text-danger" role="alert">
            {error || loadError}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
