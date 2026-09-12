---
title: Homepage multiplayer story - Plan
type: feat
date: 2026-09-12
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Homepage multiplayer story - Plan

## Goal Capsule

- **Objective:** Restack the Whip Computer homepage so the first half tells a multiplayer story, then features. Not a Granola meeting-notes clone.
- **Authority:** Product copy and order follow this contract. Voice follows `docs/grok-bot-ui.md` (named teammates, talk first, computer built in, no shared desk). Existing compare/FAQ claims stay true.
- **Open blockers:** None that block planning. Exact first-half mock (still vs motion) is deferred to planning if copy is settled.
- **Out of scope:** Office product changes, new testimonials we do not have, a `STRATEGY.md` rewrite, mobile/iOS marketing surfaces, olive wash color (separate).

## Product Contract

### Summary

The homepage after the hero is a feature catalog. The pitch is already multiplayer. Move that pitch into a three-beat story, then demote models, jobs, apps, catalog, and enterprise to the second half.

### Problem Frame

A visitor who knows Grok Bot, OpenClaw, or Hermes sees feature bands (models, adoption, knowledge, apps) before they see why this is a team product. The hire / talk / computer story exists and sits late. Granola’s useful lesson is one spine then a catalog, not before / during / after a meeting.

### Key Decisions

- KD1. First half is multiplayer, not a personal-agent desk tour. (session-settled: user-approved — chosen over hire-talk-computer-only and a team-day movie: the pitch is already “but for teams.”)
- KD2. Steal Granola’s spine (story, then features), not Granola’s job. (session-settled: user-directed — chosen over a literal before / during / after meeting clone: Whip is named teammates, not a notepad.)
- KD3. One hire / talk / computer beat stays inside the multiplayer story so the computer still has a face. Do not drop the computer from the first half.
- KD4. Keep the incumbent hero (invite only, AI for teams, compare line, CTA, demo). Do not replace it with a Granola-style product-proof mock of notes.

### Requirements

#### First half — story

- R1. After the hero (and optional short models line), the next three chapters are Seat, Room, Board — in that order — before any catalog strip.
- R2. Seat: hire a named teammate (person, not a workflow). Show one face and that they already have a computer.
- R3. Room: the whole team talks to them where they already work (Slack, Discord, Microsoft Teams). Not a private laptop agent.
- R4. Board: the company can see who started work, and chat files onto a shared knowledge base. Adoption is people plus a heatmap, not a spend cockpit.
- R5. Contrast stays visible in the first half: one person + laptop vs named teammates + one team. Reuse the existing together / compare claim; do not invent a fifth competitor.
- R6. First-half copy stays teammate voice (hire, talk, handoff, come back). No “orchestration,” “workflow builder,” or meeting-bot framing.

#### Second half — features

- R7. After Board, the page may show: no Mac Mini / lid shut, job strip, apps grid, models (if not kept as a thin hero footer), hire catalog, demo showcase, enterprise, FAQ, CTA.
- R8. Do not invent new feature sections. Reorder and retitle what exists.
- R9. The late “How it works” three-card STORY block is removed or folded into Seat / Room so hire / talk / computer is not told twice.

#### Constraints

- R10. Tests that pin homepage order (`apps/landing/src/lib/seo.test.ts`) update to the new story-then-features order. Forbidden copy (“A computer you can ignore” tiles) stays forbidden.
- R11. `docs/grok-bot-ui.md` still wins on product facts: no shared desk, no Computer Durable Object, no workflow builder.

### Flows

- F1. New visitor: hero promise → Seat / Room / Board → believes this is a team product → scrolls into jobs / apps / catalog if they want proof.
- F2. Grok Bot / OpenClaw visitor: first-half contrast answers “why not the thing I already have” before a model list or integration count.

### Acceptance Examples

- AE1. A screen-reader or source-order walk of the homepage hits Seat, Room, and Board before `#use-cases`, `#apps`, and `#hire`.
- AE2. A reader can state the difference vs OpenClaw / Hermes / Grok Bot from the first half alone, without the FAQ.
- AE3. The computer appears as “already theirs” on Seat, not as a second product in the first half.

### Outstanding Questions

- OQ1. Does the models line stay under the hero (thin footer) or move to the second half? Default: stay thin under the hero if it does not break the story.
- OQ2. Does `#together` compare grid stay in the first half (under Board) or move down? Default: a short contrast in Seat or Board, full four-column compare in the second half.

### Success

A visitor who stops at Board already has the multiplayer pitch. Features feel like shopping, not the argument.
