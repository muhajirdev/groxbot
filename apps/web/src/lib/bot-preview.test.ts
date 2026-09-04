import { afterEach, describe, expect, it } from "vitest";
import type { Bot } from "@groxbot/contracts";
import { hydrateBotPreviews, mergeBotList, overlayBotList } from "./bot-preview";
import { draftCreatedBot } from "./hire";
import { orpc, queryClient } from "./orpc";
import {
  clearOfficeMessages,
  setOfficeMessages,
  officePreviewsFromCache,
} from "./office-messages";

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
        role: "user",
        parts: [{ type: "text", text: "can you book the room" }],
      },
    ]);
    expect(overlayBotList([bot("bot-1", "")])[0]?.lastPreview).toBe(
      "can you book the room",
    );
  });
});

describe("hydrateBotPreviews", () => {
  it("writes office previews onto a restored roster", () => {
    setOfficeMessages("bot-1", [
      {
        id: "m1",
        role: "assistant",
        parts: [{ type: "text", text: "Booked for 3pm" }],
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
