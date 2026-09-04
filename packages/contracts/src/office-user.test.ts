import { describe, expect, it } from "vitest";
import { OFFICE_REVIEW_SOURCE } from "./office-review.js";
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

  it("keeps an https profile photo", () => {
    const withPhoto = {
      ...alex,
      image: "https://lh3.googleusercontent.com/a/photo",
    };
    expect(parseOfficeUser(withPhoto)).toEqual(withPhoto);
    expect(
      officeUserFromActor({
        userId: alex.userId,
        name: alex.name,
        image: withPhoto.image,
      }),
    ).toEqual(withPhoto);
  });

  it("drops a non-http profile photo", () => {
    expect(parseOfficeUser({ ...alex, image: "javascript:alert(1)" })).toEqual(
      alex,
    );
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

  it("stamps a profile photo", () => {
    const withPhoto = {
      ...alex,
      image: "https://avatars.githubusercontent.com/u/1",
    };
    const next = stampOfficeUser(
      { role: "user" as const, metadata: { user: alex } },
      withPhoto,
    );
    expect(parseOfficeUserMeta(next.metadata)).toEqual(withPhoto);
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
    const stamped = next.metadata as Record<string, unknown>;
    expect(parseOfficeUserMeta({ custom: stamped.custom })).toEqual(alex);
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

  it("does not stamp an office-review trigger as the connected human", () => {
    const row = {
      role: "user" as const,
      metadata: { source: OFFICE_REVIEW_SOURCE },
    };
    expect(stampIncomingOfficeUser(row, alex, null)).toBe(row);
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
      new Request("https://api.example/agents/RoomActor/room_1"),
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

  it("round-trips a profile photo", () => {
    const photo = "https://avatars.githubusercontent.com/u/1";
    const request = withOfficeUserRequest(
      new Request("https://api.example/agents/RoomActor/room_1"),
      { userId: "usr_1", name: "Alex", image: photo },
    );
    expect(officeUserFromHeaders(request.headers)).toEqual({
      userId: "usr_1",
      name: "Alex",
      image: photo,
    });
  });
});
