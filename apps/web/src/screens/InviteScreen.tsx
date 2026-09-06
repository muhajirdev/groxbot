import { isRedirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PersonAvatar } from "../components/PersonAvatar";
import { ensureActiveWorkspace } from "../lib/enter-office";
import { userFacingError } from "../lib/errors";
import { rememberInvite } from "../lib/invite";
import { AVATAR_COLORS } from "../lib/jobs";
import { OFFICE_TO, WORKSPACE_TO, officeParams } from "../lib/office-route";
import { orpc } from "../lib/orpc";
import { firstLiveBot, loadBotsForRoute } from "../lib/session";
import { AuthScreen } from "./AuthScreen";

export function InviteScreen(props: {
  invite: string;
  signedIn: boolean;
  errorFromUrl?: string;
}) {
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(props.errorFromUrl ?? "");
  const peekQuery = useQuery({
    ...orpc.workspaces.peek.queryOptions({
      input: { invitationId: props.invite },
    }),
  });
  const peek = peekQuery.data;

  if (signingIn) {
    return <AuthScreen errorFromUrl={error} invite={props.invite} />;
  }

  if (peekQuery.isError || peekQuery.data === null) {
    return (
      <div className="invite-page">
        <p className="invite-kicker">That invite is missing or expired.</p>
        <button
          className="btn"
          type="button"
          onClick={() => setSigningIn(true)}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!peek) {
    return (
      <div className="invite-page">
        <p className="invite-kicker">Opening invite…</p>
      </div>
    );
  }

  const members =
    peek.memberCount === 1
      ? "1 member"
      : `${peek.memberCount} members`;

  async function join() {
    if (busy) return;
    rememberInvite(props.invite);
    if (!props.signedIn) {
      setSigningIn(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const workspace = await ensureActiveWorkspace({ invite: props.invite });
      const bots = await loadBotsForRoute();
      const first = firstLiveBot(bots);
      await navigate(
        first
          ? {
              to: OFFICE_TO,
              params: officeParams(
                workspace.slug,
                first.homeRoomId || first.id,
              ),
            }
          : {
              to: WORKSPACE_TO,
              params: { workspaceSlug: workspace.slug },
            },
      );
    } catch (caught) {
      if (isRedirect(caught)) throw caught;
      setBusy(false);
      setError(userFacingError(caught, "Could not join workspace"));
    }
  }

  return (
    <div className="invite-page">
      <span
        className="invite-mark"
        style={{ background: colorForName(peek.organizationName) }}
        aria-hidden
      >
        {workspaceInitial(peek.organizationName)}
      </span>
      <p className="invite-kicker">You're invited to join</p>
      <h1>{peek.organizationName}</h1>
      <p className="invite-by">
        Invited by
        <PersonAvatar
          name={peek.inviterName}
          image={peek.inviterImage}
          size="xs"
        />
        <strong>{peek.inviterName}</strong>
      </p>
      <button
        className="btn lg"
        type="button"
        disabled={busy}
        onClick={() => void join()}
      >
        {busy ? "Joining…" : "Join workspace"}
      </button>
      {error ? <p className="error">{error}</p> : null}
      <p className="invite-meta">
        <PersonAvatar
          name={peek.inviterName}
          image={peek.inviterImage}
          size="xs"
        />
        {members}
      </p>
      <p className="invite-note">Free to join · leave anytime</p>
    </div>
  );
}

function workspaceInitial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function colorForName(name: string): string {
  let n = 0;
  for (const char of name) n += char.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
