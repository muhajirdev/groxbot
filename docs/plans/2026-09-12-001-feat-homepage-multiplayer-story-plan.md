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

- **Objective:** Restack the homepage: hero, then a three-beat how-it-works, then a “runs everywhere” hinge, then a short feature list.
- **Authority:** This contract. Voice follows `docs/grok-bot-ui.md`. Compare/FAQ claims stay true. Catalog names come from the hire marketplace, not invented roles.
- **Open blockers:** OQ1 (hire strip auto-scroll vs user scroll).
- **Out of scope:** Office product changes, fake testimonials, `STRATEGY.md`, olive wash, new marketplace templates just for the strip.

## Product Contract

### Summary

How it works is Hire a bot → Invite the team → Track adoption. A runs-everywhere bar splits story from features. Knowledge, computer/phone, models, and routines are features, not the story.

### Problem Frame

The current page is a catalog after the hero. The visitor needs one loop (get a teammate, put the team on it, see who uses it) before shopping for knowledge, models, and routines.

### Key Decisions

- KD1. First half is Hire → Invite → Adopt, not Seat / Room / Board and not a desk tour. (session-settled: user-directed — chosen over knowledge as the third beat and over a Granola before / during / after clone.)
- KD2. Steal Granola’s spine (story, then features), not Granola’s job. (session-settled: user-directed.)
- KD3. Computer / no Mac Mini is a feature, not a how-it-works beat. Hire still shows a named bot with apps, not a second Computer product.
- KD4. Keep the incumbent hero (invite only, AI for teams, compare line, CTA, demo).
- KD5. Adopt’s line is: the best way to get the team on AI is to make use visible. Still not a spend cockpit.

### Requirements

#### How it works (after hero)

- R1. After the hero, the next block is How it works with three numbered beats, in this order, before any feature chapter.
- R2. Beat 1 — Hire a bot. A long horizontal strip of marketplace bots (Social / media manager, Competitor Watch, and peers). Each card shows the bot name and the apps it connects to. The strip is one row and feels nearly endless.
- R3. Beat 2 — Invite your team to use the bot. The team talks to that hire where they already work. Not a private laptop agent.
- R4. Beat 3 — Track your team’s AI adoption. People plus a contributions heatmap. Copy: visibility is how the rest of the team starts. Not spend, not surveillance chrome.
- R5. How-it-works copy stays teammate voice. No orchestration, workflow builder, or meeting-bot framing.
- R6. The late three-card “Hire. Talk. They already have a computer.” block is removed so the story is not told twice.

#### Hinge

- R7. After Adopt, a “Runs everywhere” bar: Slack, Microsoft Teams, Discord, iOS, Android, web. This is the cut between story and features.

#### Features (after the hinge)

- R8. No Mac Mini / laptop required. Shutdown the laptop; continue from the phone. Reuse the existing phone / handoff claim.
- R9. Self-improving knowledge base. Chat is organized onto the shared tree and keeps updating. This is the knowledge aha, not a how-it-works beat.
- R10. Self-improving agent. Maps to existing Learned / soul / memory — the teammate gets better from work. Do not invent a second product.
- R11. Cheap to run. Open-source / hosted-free models at a fraction of closed-lab cost. Do not name a dollar amount we cannot keep.
- R12. Use your existing AI subscription. BYOK: Codex, Kimi, z.ai, and the models we already list. Workspace key wins.
- R13. Routines. “Runs X every day at 3am” (or equivalent). The time/cadence line animates through examples. This is Agents schedules on the home room, not a cron table.

#### Constraints

- R14. Hire-strip names and apps come from the live marketplace catalog and real integrations. Prefer Competitor Watch and a social/outbound hire that exists; do not mint “Social Media Manager” if the catalog has no such row — use the closest real listing.
- R15. Do not add feature chapters beyond R8–R13 plus existing compare / hire catalog / FAQ / CTA if those remain as closers.
- R16. `seo.test.ts` pins the new order: how-it-works (hire, invite, adopt) → runs everywhere → the feature list. Forbidden tiles copy stays forbidden.
- R17. No shared desk, no Computer Durable Object, no workflow builder.

### Flows

- F1. New visitor: hero → hire a face → invite the team → see adoption → runs everywhere → features if they keep scrolling.
- F2. Shopper: skips story, still hits runs-everywhere and features (phone, knowledge, models, routines).

### Acceptance Examples

- AE1. Source order hits Hire, Invite, Adopt before phone, knowledge, routines, and the hire catalog.
- AE2. Hire strip shows at least two real catalog bots, each with at least one real app mark.
- AE3. A reader can state “hire, then the team uses it, then you can see who did” from the first half alone.

### Outstanding Questions

- OQ1. Is the hire strip user-scrolled (same as the job row) or an auto marquee? Default: user-scrolled, one row, long enough to feel endless.

### Success

Someone who stops at Adopt already knows how Whip works. Features are reasons to stay, not the argument.
