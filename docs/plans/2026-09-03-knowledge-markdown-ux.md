---
title: Knowledge library reading UX
date: 2026-09-03
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Knowledge library reading UX

## Goal Capsule

Office Knowledge is a library modal (tree + preview), not a second computer. Notes currently render through chat markdown, so headings are the same size as body, YAML frontmatter dumps into the page, Tailwind preflight strips list bullets, and the preview chrome repeats the filename next to the document H1.

Ship a document-scale markdown reader in that modal and a quieter reading chrome. Do not change R2, search, actor identity, or chat bubble typography beyond restoring list markers.

Stop when a markdown note reads like a page (hierarchy, lists, links, frontmatter hidden), the modal is still a library, and existing office-path / chat markdown tests still pass.

## Product Contract

### Requirements

- R1. Markdown in Knowledge uses document typography: distinct H1–H3 sizes, comfortable line-height, spacing between sections.
- R2. YAML frontmatter (`---` fences) is not shown as body text for any office markdown, including notes that are not `SKILL.md`.
- R3. Lists show bullets or numbers. Links are visually distinct from body text.
- R4. Preview chrome does not shout the path in all-caps or duplicate the document title when the file already has an H1 / frontmatter title.
- R5. The library layout stays tree + preview. No file manager, no second explorer, no Skills/Notes buckets.
- R6. Chat transcripts keep compact markdown. Only list markers are restored there (Tailwind preflight currently zeroes `list-style`).

### Actors and flows

A workspace member opens Knowledge, picks `company/resources.md`, and reads it. Frontmatter stays off the page. Headings, lists, links, and code are obvious. Path is a quiet breadcrumb. Download / remove stay in the header.

### Acceptance examples

- AE1. File with `---\ntitle: Resources for agents\n---\n# Resources for agents\n\n- one` renders the heading larger than body, a bulleted list, and no `title:` line.
- AE2. `skills/foo/SKILL.md` still strips skill YAML and still offers Use in chat.
- AE3. Chat bubble `1. one\n2. two` still compact, but the `ol` is numbered.

### Product scope

In: web Knowledge modal + markdown preview CSS/helper. Out: search ranker, R2, graph algorithm, computer pane previews, new markdown engine.

## Planning Contract

### Key Technical Decisions

- KTD1. Add `splitKnowledgeMarkdown` in `apps/web/src/lib/knowledge-markdown.ts` instead of extending `packages/core` search frontmatter. Preview-only; keep search/list titles as they are. Rejected: parsing titles in `fileMeta` for every list entry (extra R2 reads).
- KTD2. Give `ChatMarkdown` a `variant: "chat" | "document"` class switch (`chat-md` vs `knowledge-md`). Rejected: a second markdown pipeline (streamdown + sanitize stay).
- KTD3. Knowledge CSS owns document scale. Chat CSS stays 1em headings. Restore `list-style` on both so Tailwind preflight does not hide markers.
- KTD4. For markdown files, chrome is path breadcrumb + backlinks + actions. Document H1 (or frontmatter title if the body has no heading) is the title. Non-markdown keeps the filename heading.

### Assumptions

- Office notes use standard `---` YAML when they have metadata (matches search’s `parseNoteFrontmatter`).
- Accent stays pink for product chrome; knowledge links use a readable blue so they do not compete with the selected-tree highlight.

### Technical approach

`KnowledgeFilePreview.TextPreview` splits body, then renders `ChatMarkdown` with `variant="document"`. `PreviewPane` stops uppercasing the path and stops showing a second H3 for markdown. Modal grows slightly so the reading column has padding.

### Sequencing

U1 helper + tests, U2 ChatMarkdown variant + CSS, U3 modal chrome. CSS has no unit test; U1/U2 cover behavior.

## Implementation Units

### U1. Split office markdown from YAML

Files: `apps/web/src/lib/knowledge-markdown.ts`, `apps/web/src/lib/knowledge-markdown.test.ts`, `apps/web/src/components/KnowledgeFilePreview.tsx`

- Parse fenced YAML; expose title, description, updated, source; return remaining body.
- Skills and notes both go through this helper (replaces `bodyOf`).
- If body has no leading ATX heading and title exists, render that title above the document.

Tests: fenced YAML stripped; missing fences leave body; skill-style `name:` still strips; quoted scalars; empty body.

### U2. Document markdown renderer

Files: `apps/web/src/components/ChatMarkdown.tsx`, `apps/web/src/lib/chat-markdown.test.ts`, `apps/web/src/styles.css`

- `variant="document"` → `knowledge-md`.
- `.knowledge-md` heading scale, lists, links, code, tables, blockquotes, hr.
- `.chat-md ul/ol` get `list-style` restored.

Tests: document variant class present; existing office-path / sanitize cases unchanged; lists still emit `ul`/`ol`.

### U3. Library reading chrome

Files: `apps/web/src/components/KnowledgeModal.tsx`, `apps/web/src/styles.css`

- Larger modal, padded reading column, path as `folder / file.md` (no uppercase).
- Markdown preview omits duplicate filename H3; keep description/backlinks/actions.
- Empty-folder / empty-library copy stays one line, less cramped padding.

Tests: none beyond existing tree tests. Verify in the running web app.

## Verification Contract

- `pnpm --filter @groxbot/web test` is not a package script; run `pnpm exec vitest run apps/web/src/lib/knowledge-markdown.test.ts apps/web/src/lib/chat-markdown.test.ts`.
- `pnpm --filter @groxbot/web check` (tsc).
- Open Knowledge in the web app, open a markdown note with headings/lists/links/frontmatter, confirm hierarchy and no YAML dump. Spot-check a skill and a chat bubble list.

## Definition of Done

- R1–R6 met. U1–U3 landed. Frontmatter never appears as prose. Chat compact headings unchanged. Library still tree + preview.
