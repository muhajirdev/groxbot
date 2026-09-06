import { describe, expect, it } from "vitest";
import {
  PLUGIN_SEARCH_FETCH_LIMIT,
  pluginExecuteArguments,
  pluginSearchParams,
  pluginSearchQuery,
  rankPluginHits,
} from "./plugin-search.js";

describe("pluginSearchQuery", () => {
  it("keeps a short verb", () => {
    expect(pluginSearchQuery("send", ["gmail"])).toBe("send");
  });

  it("collapses a gmail sentence to the toolkit", () => {
    expect(
      pluginSearchQuery("gmail list recent inbox messages", ["gmail"]),
    ).toBe("gmail");
    expect(
      pluginSearchQuery("gmail read inbox list messages", ["gmail"]),
    ).toBe("gmail");
  });

  it("infers gmail from inbox/email words", () => {
    expect(
      pluginSearchQuery("list recent inbox messages bulk fetch", ["gmail"]),
    ).toBe("gmail");
  });

  it("passes a tool slug through", () => {
    expect(pluginSearchQuery("GMAIL_FETCH_EMAILS", ["gmail"])).toBe(
      "GMAIL_FETCH_EMAILS",
    );
  });

  it("ranks fetch/list ahead of labels", () => {
    const ranked = rankPluginHits(
      [
        { slug: "GMAIL_ADD_LABEL_TO_EMAIL", name: "Modify labels" },
        { slug: "GMAIL_BATCH_DELETE_MESSAGES", name: "Batch delete" },
        { slug: "GMAIL_CREATE_EMAIL_DRAFT", name: "Create draft" },
        { slug: "GMAIL_FETCH_EMAILS", name: "Fetch emails" },
        { slug: "GMAIL_LIST_MESSAGES", name: "List messages" },
      ],
      "gmail",
    );
    expect(ranked.map((row) => row.slug).slice(0, 2)).toEqual([
      "GMAIL_FETCH_EMAILS",
      "GMAIL_LIST_MESSAGES",
    ]);
  });

  it("ranks send first when the query is send", () => {
    const ranked = rankPluginHits(
      [
        { slug: "GMAIL_FETCH_EMAILS", name: "Fetch emails" },
        { slug: "GMAIL_SEND_EMAIL", name: "Send Email" },
      ],
      "send",
    );
    expect(ranked[0]?.slug).toBe("GMAIL_SEND_EMAIL");
  });

  it("omits query for a toolkit browse and keeps it for a verb", () => {
    expect(pluginSearchParams("gmail list recent inbox", ["gmail"])).toEqual({
      important: true,
      limit: PLUGIN_SEARCH_FETCH_LIMIT,
    });
    expect(pluginSearchParams("send", ["gmail"])).toEqual({
      important: true,
      limit: PLUGIN_SEARCH_FETCH_LIMIT,
      query: "send",
    });
  });

  it("defaults Gmail fetch to metadata, not full MIME", () => {
    expect(pluginExecuteArguments("GMAIL_FETCH_EMAILS", { query: "in:inbox" })).toEqual({
      verbose: false,
      include_payload: false,
      max_results: 5,
      query: "in:inbox",
    });
    expect(
      pluginExecuteArguments("GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", {
        message_id: "abc",
      }),
    ).toEqual({ format: "metadata", message_id: "abc" });
    expect(
      pluginExecuteArguments("GMAIL_FETCH_EMAILS", { verbose: true, max_results: 1 }),
    ).toMatchObject({ verbose: true, max_results: 1 });
    expect(pluginExecuteArguments("GMAIL_FETCH_EMAILS")).toMatchObject({
      query: "in:inbox",
      max_results: 5,
      verbose: false,
      include_payload: false,
    });
  });
});
