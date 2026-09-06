import { MAIL_LOG } from "@groxbot/contracts";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AvatarMark } from "../components/Avatar";
import { GitHubIcon, GoogleIcon } from "../components/Icons";
import { OnboardingVideo } from "../components/OnboardingDialog";
import { authClient } from "../lib/auth";
import { userFacingError } from "../lib/errors";
import { officeUrl } from "../lib/host";
import { readRememberedInvite, rememberInvite } from "../lib/invite";
import { orpc } from "../lib/orpc";
import { Field, Input } from "../ui";

export function AuthScreen(props: { errorFromUrl?: string; invite?: string }) {
  const health = useQuery(orpc.health.queryOptions());
  const [error, setError] = useState(props.errorFromUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const emailSend = useRef(0);
  const providers = health.data?.oauth ?? [];
  const googleReady = providers.includes("google");
  const githubReady = providers.includes("github");
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
    ? `/?invite=${encodeURIComponent(invite)}`
    : "/";

  useEffect(() => {
    if (props.errorFromUrl) setError(props.errorFromUrl);
  }, [props.errorFromUrl]);

  useEffect(() => {
    if (peek?.email) setEmail(peek.email);
  }, [peek?.email]);

  async function continueWithSocial(provider: "google" | "github") {
    setBusy(true);
    setError("");
    if (!providers.includes(provider)) {
      setBusy(false);
      setError(
        `${provider === "google" ? "Google" : "GitHub"} sign-in is not configured on this API.`,
      );
      return;
    }
    rememberInvite(invite);
    const result = await authClient.signIn.social({
      provider,
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
        setError(result.error.message ?? "Could not send a code");
      } else {
        setOtp("");
      }
    } catch (caught) {
      if (sendId !== emailSend.current) return;
      setSentTo("");
      setError(userFacingError(caught, "Could not send a code"));
    }
  }

  async function continueWithCode(event: FormEvent) {
    event.preventDefault();
    const code = otp.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.emailOtp({
        email: sentTo,
        otp: code,
      });
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "That code did not work");
        return;
      }
      window.location.assign(officeUrl(afterAuth));
    } catch (caught) {
      setBusy(false);
      setError(userFacingError(caught, "That code did not work"));
    }
  }

  const heading = peek
    ? `Join ${peek.organizationName}`
    : invite
      ? "Join a workspace"
      : "Sign in";
  const lede = peek
    ? peek.email
      ? `You've been invited as ${peek.email}.`
      : `Sign in to join ${peek.organizationName}.`
    : invite
      ? peekQuery.isError || peekQuery.data === null
        ? "That invite is missing or expired. Sign in, then paste a new one."
        : "Sign in to join the workspace you were invited to."
      : "or create an account to get started";

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <AvatarMark
          name="Groxbot"
          color="#e45c9a"
          shape="circle"
          size="md"
          mood="happy"
          hero
        />
        Groxbot
      </div>
      <div className="auth-card">
        <div className="auth-card-form">
          {sentTo ? (
            <>
              <h1>Check your email</h1>
              <p className="lede">
                We sent a code to <strong>{sentTo}</strong>. Expires in 15
                minutes.
              </p>
              {mailLogged ? (
                <p className="lede">
                  Locally, that link and code are printed in the API terminal
                  instead of an inbox.
                </p>
              ) : null}
              <form className="auth-email" onSubmit={continueWithCode}>
                <Field label="Code" className="field">
                  <Input
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otp}
                    maxLength={6}
                    onChange={(event) =>
                      setOtp(
                        event.currentTarget.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    disabled={busy}
                    required
                  />
                </Field>
                <button
                  className="btn"
                  type="submit"
                  disabled={busy || otp.length !== 6}
                >
                  {busy ? "Signing in…" : "Enter code"}
                </button>
              </form>
              <div className="auth-foot">
                <button
                  type="button"
                  onClick={() => {
                    emailSend.current += 1;
                    setSentTo("");
                    setOtp("");
                    setError("");
                  }}
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>{heading}</h1>
              <p className="lede">{lede}</p>
              <p className="auth-hint">
                Enter your email — we'll send you a verification code.
              </p>
              <form className="auth-email" onSubmit={continueWithEmail}>
                <Field label="Email" className="field">
                  <Input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@example.com"
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
                  {busy ? "Sending…" : "Send code"}
                </button>
              </form>
              {googleReady || githubReady ? (
                <>
                  <p className="or-line">Or continue with</p>
                  <div className="auth-oauth">
                    {githubReady ? (
                      <button
                        className="btn ghost oauth-btn"
                        type="button"
                        disabled={busy || health.isLoading}
                        onClick={() => void continueWithSocial("github")}
                      >
                        <GitHubIcon />
                        GitHub
                      </button>
                    ) : null}
                    {googleReady ? (
                      <button
                        className="btn ghost oauth-btn"
                        type="button"
                        disabled={busy || health.isLoading}
                        onClick={() => void continueWithSocial("google")}
                      >
                        <GoogleIcon />
                        Google
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </>
          )}
          {error ? <p className="error">{error}</p> : null}
        </div>
        <aside className="auth-card-video" aria-label="Product walkthrough">
          <OnboardingVideo className="auth-video" />
        </aside>
      </div>
    </div>
  );
}
