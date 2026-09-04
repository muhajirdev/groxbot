import type { Bot } from "@groxbot/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  hydrateBotPreviews,
  mergeBotList,
  overlayBotList,
} from "./bot-preview";
import { draftCreatedBot } from "./hire";
import {
  clearOfficeMessages,
  officePreviewsFromCache,
  setOfficeMessages,
} from "./office-messages";
import { orpc, queryClient } from "./orpc";

const botsKey = orpc.bots.list.queryOptions().queryKey;

function bot(id: string, lastPreview: string, title = ""): Bot {
  return {
    ...draftCreatedBot({
      id,
      workspaceId: "ws-1",
      name: id,
      avatarColor: "#e45c9a",
    }),
    title,
    lastPreview,
  };
}

afterEach(() => {
  clearOfficeMessages();
  queryClient.removeQueries({ queryKey: botsKey });
});

describe("mergeBotList", () => {
  it("keeps a cached preview when the server sends an empty one", () => {
    const server = [bot("bot-1", "")];
    const cached = [bot("bot-1", "Booked the room")];
    expect(mergeBotList(server, cached, new Map())[0]?.lastPreview).toBe(
      "Booked the room",
    );
  });

  it("prefers the cached office thread over the roster snapshot", () => {
    const server = [bot("bot-1", "")];
    const cached = [bot("bot-1", "older line")];
    const office = new Map([["bot-1", "Latest reply"]]);
    expect(mergeBotList(server, cached, office)[0]?.lastPreview).toBe(
      "Latest reply",
    );
  });

  it("keeps a Postgres preview when there is no office cache", () => {
    const server = [bot("bot-1", "From poke")];
    expect(mergeBotList(server, undefined, new Map())[0]?.lastPreview).toBe(
      "From poke",
    );
  });

  it("leaves title alone", () => {
    const server = [bot("bot-1", "", "Office manager")];
    expect(mergeBotList(server, undefined, new Map())[0]?.title).toBe(
      "Office manager",
    );
  });

  it("reuses the server row when the preview is unchanged", () => {
    const server = [bot("bot-1", "same")];
    expect(mergeBotList(server, server, new Map())[0]).toBe(server[0]);
  });
});

describe("overlayBotList", () => {
  it("fills an empty list row from persisted office messages", () => {
    setOfficeMessages("bot-1", [
      {
        id: "m1",
        message: {
          role: "user",
          content: "can you book the room",
          timestamp: 1,
        },
      },
    ]);
    expect(overlayBotList([bot("bot-1", "")])[0]?.lastPreview).toBe(
      "can you book the room",
    );
  });

  it("fills an empty list row from persisted office messages keyed by home room", () => {
    setOfficeMessages("home-1", [
      {
        id: "m1",
        message: {
          role: "user",
          content: "can you book the room",
          timestamp: 1,
        },
      },
    ]);
    expect(
      overlayBotList([
        {
          ...bot("bot-1", ""),
          homeRoomId: "home-1",
        },
      ])[0]?.lastPreview,
    ).toBe("can you book the room");
  });
});

describe("hydrateBotPreviews", () => {
  it("writes office previews onto a restored roster", () => {
    setOfficeMessages("bot-1", [
      {
        id: "m1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Booked for 3pm" }],
          timestamp: 1,
        },
      },
    ]);
    queryClient.setQueryData(botsKey, [bot("bot-1", "")]);
    hydrateBotPreviews();
    expect(queryClient.getQueryData<Bot[]>(botsKey)?.[0]?.lastPreview).toBe(
      "Booked for 3pm",
    );
    expect(officePreviewsFromCache().get("bot-1")).toBe("Booked for 3pm");
  });
});
