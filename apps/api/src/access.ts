import type { Hono } from "hono";
import {
  DEFAULT_ACCESS_REQUEST_TO,
  type MailEnv,
  sendAccessRequestMail,
} from "./mail.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_NAME = 120;
const MAX_NOTE = 2000;

export type AccessRequest = {
  email: string;
  name: string;
  note: string;
  honey: boolean;
};

export function parseAccessRequest(
  body: unknown,
): { ok: true; value: AccessRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Send your email." };
  }
  const record = body as Record<string, unknown>;
  const email = stringify(record.email).toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  const name = stringify(record.name);
  if (name.length > MAX_NAME) {
    return { ok: false, error: "Keep your name shorter." };
  }
  const note = stringify(record.note);
  if (note.length > MAX_NOTE) {
    return { ok: false, error: "Keep the note shorter." };
  }
  const honey = stringify(record.website).length > 0;
  return { ok: true, value: { email, name, note, honey } };
}

function stringify(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function accessInbox(env: MailEnv): string {
  return env.accessRequestTo?.trim() || DEFAULT_ACCESS_REQUEST_TO;
}

export function mountAccessRequest(app: Hono, env: MailEnv) {
  app.post("/api/access/request", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ message: "Send your email." }, 400);
    }
    const parsed = parseAccessRequest(body);
    if (!parsed.ok) return c.json({ message: parsed.error }, 400);
    if (parsed.value.honey) return c.json({ ok: true as const });
    try {
      await sendAccessRequestMail(env, parsed.value);
      return c.json({ ok: true as const });
    } catch {
      return c.json({ message: "Could not send that request." }, 502);
    }
  });
}
