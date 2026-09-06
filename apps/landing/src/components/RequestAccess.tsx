import { type FormEvent, useState } from "react";
import { accessRequestUrl, appLoginUrl } from "../lib/app-url";

export function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(accessRequestUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: address,
          note: note.trim(),
          website: website.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(payload?.message?.trim() || "Could not send that request.");
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Could not send that request.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="access-form access-sent" id="access">
        <p className="kicker">Request sent</p>
        <p className="lede tight">
          We’ll email you when there’s a seat. Already in?{" "}
          <a href={appLoginUrl()}>Sign in</a>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="access-form"
      id="access"
      onSubmit={(event) => void onSubmit(event)}
    >
      <p className="kicker">Request access</p>
      <label className="access-honey" htmlFor="access-website">
        Website
        <input
          id="access-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.currentTarget.value)}
        />
      </label>
      <div className="access-fields">
        <input
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          disabled={busy}
        />
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          disabled={busy}
          required
        />
      </div>
      <textarea
        name="note"
        rows={3}
        placeholder="What would you use Groxbot for?"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        disabled={busy}
      />
      <div className="row">
        <button className="btn lg" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Request access"}
        </button>
        <a className="btn ghost" href={appLoginUrl()}>
          Sign in
        </a>
      </div>
      {error ? <p className="access-error">{error}</p> : null}
    </form>
  );
}
