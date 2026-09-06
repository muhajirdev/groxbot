import { isRedirect, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ensureActiveWorkspace,
  officeOpenError,
} from "../../lib/enter-office";
import { userFacingError } from "../../lib/errors";
import { OFFICE_TO, WORKSPACE_TO, officeParams } from "../../lib/office-route";
import { client } from "../../lib/rpc";
import { setRpcWorkspaceId } from "../../lib/rpc-workspace";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import { rememberListedWorkspace } from "../../lib/workspace-catalog";
import { writeCachedWorkspace } from "../../lib/workspace-switcher";
import { Button, Field, Input } from "../../ui";

type OnboardingSearch = {
  invite?: string;
};

function openOffice(workspace: { slug: string }, roomId?: string) {
  if (roomId) {
    return {
      to: OFFICE_TO,
      params: officeParams(workspace.slug, roomId),
    } as const;
  }
  return {
    to: WORKSPACE_TO,
    params: { workspaceSlug: workspace.slug },
  } as const;
}

export const Route = createFileRoute("/_authed/onboarding")({
  validateSearch: (
    search: Record<string, unknown> | undefined,
  ): OnboardingSearch => {
    const raw = search ?? {};
    return {
      invite: typeof raw.invite === "string" ? raw.invite : undefined,
    };
  },
  loader: async ({ search }) => {
    try {
      const workspace = await ensureActiveWorkspace({ invite: search?.invite });
      const bots = await loadBotsForRoute();
      const first = firstLiveBot(bots);
      throw redirect(
        openOffice(workspace, first ? first.homeRoomId || first.id : undefined),
      );
    } catch (caught) {
      if (isRedirect(caught)) throw caught;
      return { error: officeOpenError(caught) };
    }
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { invite: inviteFromSearch } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const [inviteId, setInviteId] = useState(inviteFromSearch ?? "");
  const [error, setError] = useState(loaded.error ?? "");
  const [busy, setBusy] = useState(false);
  const joining = Boolean(inviteFromSearch || inviteId.trim());

  async function go(workspace: { slug: string }) {
    const bots = await loadBotsForRoute();
    const first = firstLiveBot(bots);
    await navigate(openOffice(workspace, first ? first.homeRoomId || first.id : undefined));
  }

  async function retry() {
    setBusy(true);
    setError("");
    try {
      if (joining) {
        const raw = inviteId.trim();
        if (!raw) {
          setError("Paste an invite to join.");
          setBusy(false);
          return;
        }
        const joined = await client.workspaces.join({ invitationId: raw });
        rememberListedWorkspace(joined);
        writeCachedWorkspace(joined);
        setRpcWorkspaceId(joined.id);
        await go(joined);
        return;
      }
      const workspace = await ensureActiveWorkspace();
      await go(workspace);
    } catch (caught) {
      setError(
        userFacingError(
          caught,
          joining ? "Could not join workspace" : "Could not open the office",
        ),
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-[360px] content-center gap-4 p-6">
      <h1 className="m-0 text-[22px] font-semibold tracking-tight">
        {joining ? "Join a workspace." : "Open the office."}
      </h1>
      <p className="m-0 text-[14px] text-muted">
        {joining
          ? "Paste the invite link. You land in the office right after."
          : "We could not open the office. Try again."}
      </p>
      {joining ? (
        <Field label="Invite">
          <Input
            value={inviteId}
            placeholder="Paste invite link or id"
            autoComplete="off"
            spellCheck={false}
            onValueChange={setInviteId}
          />
        </Field>
      ) : null}
      {error ? (
        <p className="m-0 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={busy || (joining && !inviteId.trim())}
        onClick={() => void retry()}
      >
        {busy ? "Opening…" : joining ? "Join" : "Retry"}
      </Button>
    </div>
  );
}
