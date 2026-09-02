import { describe, expect, it } from "vitest";
import {
  OFFICE_USER_ID_HEADER,
  OFFICE_USER_NAME_HEADER,
  officeUserFromActor,
  officeUserFromHeaders,
  parseOfficeUser,
  parseOfficeUserMeta,
  stampIncomingOfficeUser,
  stampOfficeUser,
  withOfficeUserMetadata,
  withOfficeUserRequest,
} from "./office-user.js";

const alex = { userId: "usr_1", name: "Alex" };

describe("parseOfficeUser", () => {
  it("reads a flat identity", () => {
    expect(parseOfficeUser(alex)).toEqual(alex);
  });

  it("reads metadata.user", () => {
    expect(parseOfficeUserMeta({ user: alex, channel: "web" })).toEqual(alex);
  });

  it("reads metadata.custom.user", () => {
    expect(parseOfficeUserMeta({ custom: { user: alex } })).toEqual(alex);
  });

  it("rejects an empty name", () => {
    expect(parseOfficeUser({ userId: "usr_1", name: "  " })).toBeNull();
  });
});

describe("officeUserFromActor", () => {
  it("falls back to the email local-part", () => {
    expect(
      officeUserFromActor({
        userId: "usr_1",
        name: "  ",
        email: "alex@office.test",
      }),
    ).toEqual({ userId: "usr_1", name: "alex" });
  });
});

describe("stampOfficeUser", () => {
  it("writes metadata.user on a user message", () => {
    const next = stampOfficeUser(
      { role: "user" as const, metadata: { channel: "web" }, parts: [] },
      alex,
    );
    expect(next.metadata).toEqual({
      channel: "web",
      user: alex,
      custom: { user: alex },
    });
  });

  it("does not stamp assistant rows", () => {
    const row = { role: "assistant" as const, metadata: {} };
    expect(stampOfficeUser(row, alex)).toBe(row);
  });

  it("mirrors the sender onto metadata.custom for assistant-ui", () => {
    const next = stampOfficeUser(
      { role: "user" as const, metadata: { user: alex } },
      alex,
    );
    expect(parseOfficeUserMeta(next.metadata)).toEqual(alex);
    expect(
      parseOfficeUserMeta({
        custom: (next.metadata as { custom: unknown }).custom,
      }),
    ).toEqual(alex);
  });

  it("overwrites a client-supplied sender", () => {
    const next = stampOfficeUser(
      { role: "user" as const, metadata: { user: { userId: "x", name: "X" } } },
      alex,
    );
    expect(parseOfficeUserMeta(next.metadata)).toEqual(alex);
  });
});

describe("stampIncomingOfficeUser", () => {
  const sam = { userId: "usr_2", name: "Sam" };

  it("stamps the connected human on a new user message", () => {
    const next = stampIncomingOfficeUser(
      { role: "user" as const, metadata: { user: { userId: "x", name: "X" } } },
      alex,
      null,
    );
    expect(parseOfficeUserMeta(next.metadata)).toEqual(alex);
  });

  it("keeps the stored sender when the row already exists", () => {
    const next = stampIncomingOfficeUser(
      { role: "user" as const, metadata: { user: alex } },
      alex,
      { metadata: { user: sam } },
    );
    expect(parseOfficeUserMeta(next.metadata)).toEqual(sam);
  });

  it("does not assign the connected human to an old unlabeled row", () => {
    const row = { role: "user" as const, metadata: {} };
    expect(stampIncomingOfficeUser(row, alex, { metadata: {} })).toBe(row);
  });
});

describe("withOfficeUserMetadata", () => {
  it("merges onto a send payload", () => {
    const next = withOfficeUserMetadata({ text: "hi" }, alex);
    expect(next).toEqual({
      text: "hi",
      metadata: { user: alex, custom: { user: alex } },
    });
  });
});

describe("office user headers", () => {
  it("round-trips unicode names", () => {
    const request = withOfficeUserRequest(
      new Request("https://api.example/agents/BotActor/bot_1"),
      { userId: "usr_1", name: "José" },
    );
    expect(request.headers.get(OFFICE_USER_ID_HEADER)).toBe("usr_1");
    expect(request.headers.get(OFFICE_USER_NAME_HEADER)).toBe(
      encodeURIComponent("José"),
    );
    expect(officeUserFromHeaders(request.headers)).toEqual({
      userId: "usr_1",
      name: "José",
    });
  });
});
