import { describe, expect, it } from "vitest";
import {
  seedOutgoingUserMessage,
  textFromOutgoingPayload,
} from "./outgoing-user-message";

describe("seedOutgoingUserMessage", () => {
  it("keeps parts and office metadata", () => {
    const seeded = seedOutgoingUserMessage(
      {
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        metadata: { custom: { officeUser: { userId: "u1" } } },
      },
      "msg-1",
    );
    expect(seeded).toMatchObject({
      id: "msg-1",
      metadata: { custom: { officeUser: { userId: "u1" } } },
      message: { role: "user", content: "hello" },
    });
  });

  it("lifts a text payload into a part", () => {
    expect(seedOutgoingUserMessage({ text: "hi" }, "msg-2")).toMatchObject({
      id: "msg-2",
      message: { role: "user", content: "hi" },
    });
  });

  it("reads preview text from parts or text", () => {
    expect(
      textFromOutgoingPayload({
        parts: [{ type: "text", text: "hello" }],
      }),
    ).toBe("hello");
    expect(textFromOutgoingPayload({ text: "hi" })).toBe("hi");
  });

  it("ignores empty payloads", () => {
    expect(seedOutgoingUserMessage(null, "msg-3")).toBeNull();
    expect(seedOutgoingUserMessage({}, "msg-4")).toBeNull();
  });
});
