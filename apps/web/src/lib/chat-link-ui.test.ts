import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChatFileLink,
  ComputerFileOpenProvider,
} from "../components/ChatFileLink";

describe("ChatFileLink", () => {
  it("turns office paths into in-app computer links", () => {
    const html = renderToStaticMarkup(
      createElement(
        ComputerFileOpenProvider,
        { onOpen: () => undefined },
        createElement(ChatFileLink, {
          href: "expandra/playbook-v0.3.md",
        }, "playbook"),
      ),
    );
    expect(html).toContain('href="#expandra/playbook-v0.3.md"');
    expect(html).toContain("playbook");
    expect(html).not.toContain("http://");
  });

  it("opens http links in a new tab", () => {
    const html = renderToStaticMarkup(
      createElement(ChatFileLink, { href: "https://expandra.ai/playbook" }, "site"),
    );
    expect(html).toContain('href="https://expandra.ai/playbook"');
    expect(html).toContain('target="_blank"');
  });

  it("does not navigate relative paths without a computer opener", () => {
    const html = renderToStaticMarkup(
      createElement(ChatFileLink, { href: "expandra/playbook-v0.3.md" }, "playbook"),
    );
    expect(html).toContain("<span");
    expect(html).not.toContain("href=");
  });
});
