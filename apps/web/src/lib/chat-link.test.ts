import { describe, expect, it } from "vitest";
import { parseChatHref } from "./chat-link";

const ORIGIN = "http://127.0.0.1:5173";

describe("parseChatHref", () => {
  it("treats office-root paths as computer files", () => {
    expect(parseChatHref("expandra/playbook-v0.3.md")).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
    expect(parseChatHref("/expandra/playbook-v0.3.md")).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
    expect(parseChatHref("./notes/memory.md#top")).toEqual({
      kind: "path",
      path: "notes/memory.md",
    });
  });

  it("keeps http, https, and mailto", () => {
    expect(parseChatHref("https://expandra.ai/playbook")).toEqual({
      kind: "external",
      href: "https://expandra.ai/playbook",
    });
    expect(parseChatHref("mailto:a@b.co")).toEqual({
      kind: "external",
      href: "mailto:a@b.co",
    });
  });

  it("unwraps same-origin file URLs so they are not pages", () => {
    expect(
      parseChatHref("http://127.0.0.1:5173/expandra/playbook-v0.3.md", ORIGIN),
    ).toEqual({
      kind: "path",
      path: "expandra/playbook-v0.3.md",
    });
  });

  it("does not treat same-origin app routes as files", () => {
    expect(parseChatHref("http://127.0.0.1:5173/onboarding", ORIGIN)).toEqual({
      kind: "external",
      href: "http://127.0.0.1:5173/onboarding",
    });
  });

  it("rejects javascript and parent paths", () => {
    expect(parseChatHref("javascript:alert(1)")).toEqual({ kind: "invalid" });
    expect(parseChatHref("../secret.md")).toEqual({ kind: "invalid" });
  });
});
