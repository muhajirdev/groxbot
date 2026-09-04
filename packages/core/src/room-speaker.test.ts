import { describe, expect, it } from "vitest";
import {
  parseRoomSpeaker,
  piGroupLoopMessages,
  withRoomSpeaker,
} from "./room-speaker.js";
import type { PiBoundMessage } from "./pi-transcript.js";

describe("parseRoomSpeaker", () => {
  it("reads speaker from metadata.custom", () => {
    const metadata = withRoomSpeaker(null, {
      id: "alexander",
      name: "Alexander the Great",
    });
    expect(parseRoomSpeaker(metadata)).toEqual({
      botId: "alexander",
      name: "Alexander the Great",
    });
  });
});

describe("piGroupLoopMessages", () => {
  it("keeps this seat as assistant and names the other people", () => {
    const steveMeta = withRoomSpeaker(null, { id: "steve", name: "Steve Jobs" });
    const alexMeta = withRoomSpeaker(null, {
      id: "alexander",
      name: "Alexander the Great",
    });
    const messages: PiBoundMessage[] = [
      {
        id: "u1",
        message: { role: "user", content: "Who should we copy?", timestamp: 1 },
      },
      {
        id: "a1",
        metadata: steveMeta,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Stay hungry." }],
          timestamp: 2,
        },
      },
      {
        id: "a2",
        metadata: alexMeta,
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Take the city." }],
          timestamp: 3,
        },
      },
    ];
    const asAlexander = piGroupLoopMessages(messages, "alexander");
    expect(asAlexander.map((row) => row.role)).toEqual([
      "user",
      "user",
      "assistant",
    ]);
    expect(asAlexander[1]).toMatchObject({
      role: "user",
      content: "Steve Jobs: Stay hungry.",
    });
    expect(asAlexander[2]).toMatchObject({
      role: "assistant",
      content: [{ type: "text", text: "Take the city." }],
    });
  });
});
