import { afterEach, describe, expect, it } from "vitest";
import { orpc, queryClient } from "./orpc";
import {
  clearRoomMessages,
  peekRoomMessages,
  roomMessagesKey,
  setRoomMessages,
} from "./room-messages";

const roomId = "room-cache-test";
const roomsKey = orpc.rooms.list.queryOptions().queryKey;

afterEach(() => {
  clearRoomMessages();
  queryClient.removeQueries({ queryKey: roomsKey });
});

describe("room messages cache", () => {
  it("is keyed by roomId, not botId", () => {
    expect(roomMessagesKey(" board ")).toEqual(["room-messages", "board"]);
    setRoomMessages(roomId, [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Agenda" }],
      },
    ]);
    expect(peekRoomMessages(roomId)?.[0]?.id).toBe("m1");
    expect(queryClient.getQueryData(["office-messages", roomId])).toBeUndefined();
  });
});
