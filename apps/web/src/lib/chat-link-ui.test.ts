import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChatFileLink,
  ComputerFileOpenProvider,
  KnowledgeFileOpenProvider,
} from "../components/ChatFileLink";

describe("ChatFileLink", () => {
  it("turns office paths into in-app computer links", () => {
    const html = renderToStaticMarkup(
      createElement(
        ComputerFileOpenProvider,
        { onOpen: () => undefined },
        createElement(
          ChatFileLink,
          {
            href: "expandra/playbook-v0.3.md",
          },
          "playbook",
        ),
      ),
    );
    expect(html).toContain('href="#expandra/playbook-v0.3.md"');
    expect(html).toContain("playbook");
    expect(html).not.toContain("http://");
  });

  it("opens http links in a new tab", () => {
    const html = renderToStaticMarkup(
      createElement(
        ChatFileLink,
        { href: "https://expandra.ai/playbook" },
        "site",
      ),
    );
    expect(html).toContain('href="https://expandra.ai/playbook"');
    expect(html).toContain('target="_blank"');
  });

  it("does not navigate relative paths without a computer opener", () => {
    const html = renderToStaticMarkup(
      createElement(
        ChatFileLink,
        { href: "expandra/playbook-v0.3.md" },
        "playbook",
      ),
    );
    expect(html).toContain("<span");
    expect(html).not.toContain("href=");
  });

  it("opens a backtick file name as a computer path", () => {
    const html = renderToStaticMarkup(
      createElement(
        ComputerFileOpenProvider,
        { onOpen: () => undefined },
        createElement(ChatFileLink, { href: "essay-car.md" }, "essay-car.md"),
      ),
    );
    expect(html).toContain('href="#essay-car.md"');
    expect(html).toContain("essay-car.md");
  });

  it("opens a skill chip in knowledge, not on the computer", () => {
    const html = renderToStaticMarkup(
      createElement(
        KnowledgeFileOpenProvider,
        { onOpen: () => undefined },
        createElement(
          ChatFileLink,
          { href: "skills/sinemart-receipt-fraud-review/SKILL.md" },
          "skills/sinemart-receipt-fraud-review/SKILL.md",
        ),
      ),
    );
    expect(html).toContain(
      'href="#skills/sinemart-receipt-fraud-review/SKILL.md"',
    );
    expect(html).toContain(
      'title="skills/sinemart-receipt-fraud-review/SKILL.md"',
    );
  });

  it("does not treat a skill path as a computer file when knowledge can open it", () => {
    const html = renderToStaticMarkup(
      createElement(
        ComputerFileOpenProvider,
        { onOpen: () => undefined },
        createElement(
          KnowledgeFileOpenProvider,
          { onOpen: () => undefined },
          createElement(ChatFileLink, { href: "SKILL.md" }, "SKILL.md"),
        ),
      ),
    );
    expect(html).toContain('href="#SKILL.md"');
  });
});
