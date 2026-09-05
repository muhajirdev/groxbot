import { MAIL_LOG } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { GateMark, GateShell } from "../components/Gate";
import { GoogleIcon } from "../components/Icons";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { apiOrigin, officeUrl } from "../lib/host";
import { readRememberedInvite, rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { Field, Input } from "../ui";

export function AuthScreen(props: { errorFromUrl?: string; invite?: string }) {
  const health = useQuery(orpc.health.queryOptions());
  const [error, setError] = useState(props.errorFromUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const emailSend = useRef(0);
  const googleReady = health.data?.oauth?.includes("google") ?? false;
  const mailLogged = health.data?.mail === MAIL_LOG;
  const invite = props.invite?.trim() || readRememberedInvite();
  const peekQuery = useQuery({
    ...orpc.workspaces.peek.queryOptions({
      input: { invitationId: invite || "-" },
    }),
    enabled: Boolean(invite),
  });
  const peek = peekQuery.data ?? undefined;
  const afterAuth = invite
    ? `/onboarding?invite=${encodeURIComponent(invite)}`
    : "/";
  const errorPath = invite
    ? `/login?invite=${encodeURIComponent(invite)}`
    : "/login";

  useEffect(() => {
    if (props.errorFromUrl) setError(props.errorFromUrl);
  }, [props.errorFromUrl]);

  useEffect(() => {
    if (peek?.email) setEmail(peek.email);
  }, [peek?.email]);

  async function continueWithGoogle() {
    setBusy(true);
    setError("");
    if (!googleReady) {
      setBusy(false);
      setError("Google sign-in is not configured on this API.");
      return;
    }
    rememberInvite(invite);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: officeUrl(afterAuth),
      errorCallbackURL: officeUrl(errorPath),
    });
    setBusy(false);
    if (result.error) setError(result.error.message ?? "Could not continue");
  }

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    const sendId = ++emailSend.current;
    setError("");
    rememberInvite(invite);
    setSentTo(address);
    try {
      const result = await authClient.signIn.magicLink({
        email: address,
        callbackURL: officeUrl(afterAuth),
        errorCallbackURL: officeUrl(errorPath),
      });
      if (sendId !== emailSend.current) return;
      if (result.error) {
        setSentTo("");
        setError(result.error.message ?? "Could not send a sign-in link");
      }
    } catch (caught) {
      if (sendId !== emailSend.current) return;
      setSentTo("");
      setError(userFacingError(caught, "Could not send a sign-in link"));
    }
  }

  async function joinInvite() {
    if (!invite) return;
    setBusy(true);
    setError("");
    rememberInvite(invite);
    try {
      const response = await fetch(`${apiOrigin()}/api/invites/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: invite }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(payload?.message?.trim() || "Could not join workspace");
        setBusy(false);
        return;
      }
      window.location.assign("/");
    } catch (caught) {
      setError(userFacingError(caught, "Could not join workspace"));
      setBusy(false);
    }
  }

  const heading = peek
    ? `Join ${peek.organizationName}.`
    : invite
      ? "Join a workspace."
      : "Get started";
  const lede = peek
    ? `You've been invited as ${peek.email}.`
    : invite
      ? peekQuery.isError || peekQuery.data === null
        ? "That invite is missing or expired. Sign in, then paste a new one."
        : "Sign in to join the workspace you were invited to."
      : "Named AI teammates you message like people. Each has a real computer. The whole team sits in one office.";

  return (
    <GateShell>
      <div className="gate-auth">
        <GateMark hero mood="happy" />
        <div className="gate-stage">
          {sentTo ? (
            <>
              <h1>Check your email</h1>
              <div className="auth-sent">
                <p>
                  We sent a sign-in link to <strong>{sentTo}</strong>. It
                  expires in 15 minutes.
                </p>
                {mailLogged ? (
                  <p>
                    Locally, that link is printed in the API terminal instead of
                    an inbox.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h1>{heading}</h1>
              <p className="lede">{lede}</p>
              {invite && peekQuery.data !== null ? (
                <button
                  className="btn"
                  type="button"
                  disabled={busy || !peek}
                  onClick={() => void joinInvite()}
                >
                  {busy ? "Joining…" : "Join"}
                </button>
              ) : (
                <form className="auth-email" onSubmit={continueWithEmail}>
                  <Field label="Email" className="field">
                    <Input
                      type="email"
                      name="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(event) => setEmail(event.currentTarget.value)}
                      disabled={busy || health.isLoading}
                      required
                    />
                  </Field>
                  <button
                    className="btn"
                    type="submit"
                    disabled={busy || health.isLoading}
                  >
                    Email me a sign-in link
                  </button>
                </form>
              )}
              <p className="or-line">or</p>
              <div className="oauth">
                <button
                  className="btn ghost oauth-btn"
                  type="button"
                  disabled={busy || health.isLoading}
                  onClick={() => void continueWithGoogle()}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </div>
            </>
          )}
          {error ? <p className="error">{error}</p> : null}
          <div className="auth-foot">
            {sentTo ? (
              <button
                type="button"
                onClick={() => {
                  emailSend.current += 1;
                  setSentTo("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            ) : (
              <Link to="/" viewTransition>
                Back
              </Link>
            )}
          </div>
        </div>
      </div>
    </GateShell>
  );
}
