import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  accessInbox,
  mountAccessRequest,
  parseAccessRequest,
} from "./access.js";
import { DEFAULT_ACCESS_REQUEST_TO } from "./mail.js";

describe("parseAccessRequest", () => {
  it("requires a real email", () => {
    expect(parseAccessRequest({})).toEqual({
      ok: false,
      error: "Enter a valid email.",
    });
    expect(parseAccessRequest({ email: "not-an-email" }).ok).toBe(false);
  });

  it("trims fields and flags the honeypot", () => {
    expect(
      parseAccessRequest({
        email: "  Maya@Company.com ",
        name: " Maya ",
        note: " Hire a chief of staff. ",
        website: "",
      }),
    ).toEqual({
      ok: true,
      value: {
        email: "maya@company.com",
        name: "Maya",
        note: "Hire a chief of staff.",
        honey: false,
      },
    });
    expect(
      parseAccessRequest({
        email: "maya@company.com",
        website: "https://spam.test",
      }),
    ).toMatchObject({ ok: true, value: { honey: true } });
  });
});

describe("POST /api/access/request", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the founder inbox through the EMAIL binding", async () => {
    const send = vi.fn(async () => ({ messageId: "msg_access" }));
    const app = new Hono();
    mountAccessRequest(app, {
      emailFrom: "Groxbot <noreply@mail.groxbot.com>",
      email: { send },
      accessRequestTo: DEFAULT_ACCESS_REQUEST_TO,
    });
    const response = await app.request("/api/access/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "maya@acme.com",
        name: "Maya",
        note: "Need a CoS",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "muhajir@expandra.ai",
      from: { email: "noreply@mail.groxbot.com", name: "Groxbot" },
      subject: "Access request: maya@acme.com",
    });
    expect(String(send.mock.calls[0]?.[0]?.text)).toContain("Maya");
    expect(String(send.mock.calls[0]?.[0]?.text)).toContain("Need a CoS");
  });

  it("swallows honeypot posts", async () => {
    const send = vi.fn(async () => ({ messageId: "nope" }));
    const app = new Hono();
    mountAccessRequest(app, {
      emailFrom: "noreply@mail.groxbot.com",
      email: { send },
    });
    const response = await app.request("/api/access/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "bot@spam.test",
        website: "https://spam.test",
      }),
    });
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("logs locally without the EMAIL binding", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = new Hono();
    mountAccessRequest(app, { production: false });
    const response = await app.request("/api/access/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "maya@acme.com" }),
    });
    expect(response.status).toBe(200);
    expect(info.mock.calls[0]?.[0]).toMatch(
      /Access request for muhajir@expandra.ai/,
    );
  });
});

describe("accessInbox", () => {
  it("defaults to the founder mailbox", () => {
    expect(accessInbox({})).toBe("muhajir@expandra.ai");
    expect(accessInbox({ accessRequestTo: " other@expandra.ai " })).toBe(
      "other@expandra.ai",
    );
  });
});
