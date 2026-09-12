import {
  createFileRoute,
  isRedirect,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { OnboardingOrg } from "../../components/OnboardingOrg";
import { ensureActiveWorkspace, officeOpenError } from "../../lib/enter-office";
import { userFacingError } from "../../lib/errors";
import { OFFICE_TO, officeParams, WORKSPACE_TO } from "../../lib/office-route";
import { defaultWorkspaceName } from "../../lib/onboarding";
import { orpc, queryClient } from "../../lib/orpc";
import { client } from "../../lib/rpc";
import { setRpcWorkspaceId } from "../../lib/rpc-workspace";
import { firstLiveBot, loadBotsForRoute } from "../../lib/session";
import {
  patchMeWorkspace,
  rememberListedWorkspace,
} from "../../lib/workspace-catalog";
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
      const me = await queryClient.ensureQueryData(orpc.me.queryOptions());
      if (!search?.invite && me.needsWorkspace) {
        return { defaultName: defaultWorkspaceName(me) };
      }
      const workspace = await ensureActiveWorkspace({ invite: search?.invite });
      const bots = await loadBotsForRoute();
      const first = firstLiveBot(bots);
      throw redirect(
        openOffice(workspace, first ? first.homeRoomId || first.id : undefined),
      );
    } catch (caught) {
      if (isRedirect(caught)) throw caught;
      const me = queryClient.getQueryData(orpc.me.queryOptions().queryKey);
      return {
        error: officeOpenError(caught),
        defaultName: defaultWorkspaceName(me),
      };
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
    await navigate(
      openOffice(workspace, first ? first.homeRoomId || first.id : undefined),
    );
  }

  async function createOffice(input: {
    name: string;
    goal: string;
    team: string;
  }) {
    const name = input.name.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const created = await client.workspaces.create({
        name,
        goal: input.goal.trim() || undefined,
        team: input.team.trim() || undefined,
      });
      rememberListedWorkspace(created);
      writeCachedWorkspace(created);
      setRpcWorkspaceId(created.id);
      patchMeWorkspace(created);
      await queryClient.fetchQuery(orpc.me.queryOptions());
      await go(created);
    } catch (caught) {
      setError(userFacingError(caught, "Could not create workspace"));
      setBusy(false);
    }
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

  if (!joining) {
    return (
      <OnboardingOrg
        className="min-h-dvh"
        defaultName={loaded.defaultName ?? "Workspace"}
        error={error}
        busy={busy}
        onCreate={(input) => void createOffice(input)}
      />
    );
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-[360px] content-center gap-4 p-6">
      <h1 className="m-0 text-[22px] font-semibold tracking-tight">
        Join a workspace.
      </h1>
      <p className="m-0 text-[14px] text-muted">
        Paste the invite link. You land in the office right after.
      </p>
      <Field label="Invite">
        <Input
          value={inviteId}
          placeholder="Paste invite link or id"
          autoComplete="off"
          spellCheck={false}
          onValueChange={setInviteId}
        />
      </Field>
      {error ? (
        <p className="m-0 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={busy || !inviteId.trim()}
        onClick={() => void retry()}
      >
        {busy ? "Opening…" : "Join"}
      </Button>
    </div>
  );
}
