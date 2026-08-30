import { MAIL_LOG } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GateMark, GateShell } from "../components/Gate";
import { GoogleIcon } from "../components/Icons";
import { authClient } from "../lib/auth";
import { rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { Field, Input } from "../ui";

export function AuthScreen(props: { errorFromUrl?: string; invite?: string }) {
  const health = useQuery(orpc.health.queryOptions());
  const [error, setError] = useState(props.errorFromUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const googleReady = health.data?.oauth?.includes("google") ?? false;
  const mailLogged = health.data?.mail === MAIL_LOG;
  const invite = props.invite?.trim();
  const afterAuth = invite
    ? `/onboarding?invite=${encodeURIComponent(invite)}`
    : "/";
  const errorCallbackURL = invite
    ? `/login?invite=${encodeURIComponent(invite)}`
    : "/login";

  useEffect(() => {
    if (props.errorFromUrl) setError(props.errorFromUrl);
  }, [props.errorFromUrl]);

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
      callbackURL: afterAuth,
      errorCallbackURL,
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
    setBusy(true);
    setError("");
    rememberInvite(invite);
    const result = await authClient.signIn.magicLink({
      email: address,
      callbackURL: afterAuth,
      errorCallbackURL,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Could not send a sign-in link");
      return;
    }
    setSentTo(address);
  }

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
                  We sent a sign-in link to <strong>{sentTo}</strong>. It expires
                  in 15 minutes.
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
              <h1>Get started</h1>
              <p className="lede">
                {invite
                  ? "Sign in to join the workspace you were invited to."
                  : "Like Grok Bot, for the whole team."}
              </p>
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
                disabled={busy}
                onClick={() => {
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
