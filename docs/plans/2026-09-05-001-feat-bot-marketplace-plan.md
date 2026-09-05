---
title: Bot marketplace - Plan
type: feat
date: 2026-09-05
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Bot marketplace - Plan

## Goal Capsule

- **Objective:** Ship a curated bot marketplace on web so members browse role/person templates and hire into the workspace roster through the existing `bots.create` path.
- **Authority:** Product behavior follows this plan’s Product Contract. Architecture follows `AGENTS.md` and `docs/rooms-plan.md` (one `RoomActor` per `roomId`, bot = roster + `homeRoomId`). Hire UX reference is `docs/grok-bot-ui.md`. Caching follows `docs/caching.md`.
- **Stop when:** Office `+` / Cmd+N / palette “New bot” opens a browse/search marketplace; Hire creates a real teammate with computer + office-intro; onboarding first-hire uses the same catalog; Plugins/Composio and knowledge skills stay separate; no UGC, DB catalog, `BotActor`, or `computers` table.
- **Execution profile:** Standard web feature — contracts catalog + web modal + hire wire + onboarding reuse + doc trim. Offline vitest; no live AI/TinyFish.
- **Out of scope for this run:** Mobile hire screen parity, landing page rewrite, paid listings, ratings, user-published templates.

## Product Contract

### Summary

Groxbot already hires via a bare name dialog (`HireDialog`) and onboarding job chips (`SUGGESTED_JOBS`). Users now want a **bot marketplace like Grok Bot**: browse curated jobs/people, then hire. That is a roster hire surface, not a skills marketplace and not the Composio plugins marketplace.

### Problem Frame

`HireDialog` is only a name + private checkbox. Onboarding has chips but office hire does not. `docs/grok-bot-ui.md` once treated job chips as first-bot suggestions only; product intent now is a browseable hire catalog that still feels like messaging teammates, not a workflow gallery.

### Requirements

#### Browse and hire

- R1. From the office, `+`, Cmd+N, and command-palette “New bot” open a bot marketplace modal (not the bare name-only dialog as the primary surface).
- R2. The marketplace lists curated templates with display name, short blurb, and category; members can search and filter by category.
- R3. Choosing Hire on a template creates a workspace bot via `bots.create` with optimistic roster paint (`draftCreatedBot` / `cacheCreatedBot`), opens the home thread, and runs the existing office-intro soul path from the hired name.
- R4. “Create your own” remains: custom name (and optional private) without picking a template.
- R5. Onboarding “Who should we hire first?” uses the same catalog (chips or cards from shared helpers), not a second hard-coded job list.

#### Catalog identity

- R6. Catalog is **first-party curated** templates (jobs and optional known-person names). Not user-published UGC, not ratings/reviews, not paid listings in v1.
- R7. Copy and UX must not confuse this with Plugins (Composio) or Knowledge skills/playbooks.

#### Instant paint and platform

- R8. Marketplace chrome opens instantly (dialog stays mounted; body may fill from in-module catalog). No boot-time prefetch of a remote catalog.
- R9. v1 ships on web (`apps/web`). Desktop inherits web. Mobile hire parity is deferred.

### Actors

- A1. Workspace member with hire access (existing auth + workspace session).
- A2. Hired bot (roster row + home `RoomActor` + Pi office-intro).

### Key Flows

- F1. Marketplace hire
  - **Trigger:** Member opens New bot and picks a template.
  - **Actors:** A1, A2
  - **Steps:** Modal opens → browse/search → Hire → optimistic draft → `bots.create` → navigate home → office-intro from name.
  - **Covered by:** R1, R2, R3, R8
- F2. Create your own
  - **Trigger:** Member chooses Create your own (or equivalent) in the marketplace.
  - **Steps:** Name (+ optional private) → same hire path as today without a template id.
  - **Covered by:** R4, R3
- F3. First-run hire
  - **Trigger:** Onboarding reaches hire step.
  - **Steps:** Same catalog → name/avatar → `bots.create` → office.
  - **Covered by:** R5, R3

### Acceptance Examples

- AE1. Covers R1–R3. Given an empty-enough roster, when the member opens New bot, searches “Talent”, and hires Talent Scout, then a bot named from that template appears in the roster and the home thread opens with office-intro.
- AE2. Covers R4. Given the marketplace open, when the member chooses Create your own and hires “Piper”, then hire succeeds without a template slug.
- AE3. Covers R7. Given Plugins open, when the member browses connectors, then no bot-template cards appear there; bot marketplace is a separate entry.

### Scope Boundaries

- In: curated catalog module, web marketplace UI, hire wiring, onboarding reuse, `docs/grok-bot-ui.md` update.
- Out: Postgres/R2 catalog table, oRPC catalog endpoint, UGC publishing, skills marketplace, plugin marketplace changes, `BotActor` / `computers` table, mobile `Hire.tsx` rewrite, seeding `instructions` essays at create time (soul still grows via `set_context` in-thread).

### Success Criteria

Marketplace is the default hire surface on web; hire still lands on a messaging teammate with a computer; catalog and Plugins stay clearly separate.

## Planning Contract

### Key Technical Decisions

- KTD1. Treat “bot marketplace” as a **curated hire catalog** that only creates roster bots. Rejected: user-published UGC marketplace; skills/playbook store; Composio plugin browse reuse.
- KTD2. Ship the catalog as a **static module in `packages/contracts`** (same class as `MODEL_CATALOG`), with search/filter helpers and tests there. Rejected: Postgres table + migrate (overkill for ~10–20 curated rows); GitHub/R2 remote fetch like Plugins (needed for large external toolkit lists, not this). `docs/caching.md` “do not bundle catalogs” applies to fat external catalogs; this is product config.
- KTD3. **No new oRPC** for listing templates in v1. Hire stays `bots.create` with existing `CreateBotInput` (`name`, optional `title`, avatar, visibility, client ids). Rejected: `bots.marketplace.list` until a remote/admin-editable source exists.
- KTD4. Replace primary `HireDialog` with a **marketplace modal** patterned on `PluginsModal` / Settings (mounted with `open`, search, categories). Keep Create your own as an in-modal path. Rejected: nested route/page “store”; keeping name-only dialog as default.
- KTD5. On Hire from a template, set bot `name` to the template’s hire name (job or person, matching onboarding/`office-intro`). Optionally set `title` to the template’s job line when the display name is a person; never write a long `instructions` essay at create. Rejected: pre-baking soul via `instructions` (conflicts with office-intro + `set_context`).
- KTD6. Derive onboarding `SUGGESTED_JOBS` (or equivalent chip list) from the shared catalog so office and gate cannot drift. Rejected: duplicating string arrays in `apps/web/src/lib/jobs.ts` and contracts.

### Assumptions

- Seed v1 entries from `docs/grok-bot-ui.md` job chips plus overlapping landing use-case titles in `apps/landing/src/data/use-cases.ts` (slim cards only — blurb/category; do not import the landing app into contracts).
- Including a few known-person names (e.g. Hormozi-style) is allowed because `officeIntroUserText` already treats known names vs jobs.
- Private checkbox remains available on Create your own; template hire defaults to shared visibility unless the modal exposes the same control (prefer exposing it on both hire paths for parity with current `HireDialog`).
- Desktop needs no separate work; Expo hire is deferred (R9).

### High-Level Technical Design

```text
packages/contracts  BOT_MARKETPLACE_CATALOG + filter/search helpers
        │
        ├─ apps/web HireMarketplaceModal (browse → hire | create-your-own)
        │         └─ Chat.tsx hire() → bots.create (unchanged server path)
        └─ apps/web Onboarding step 4 chips from same catalog
```

Server path unchanged: `apps/api/src/bots.ts` `createBot` → home room → RoomActor init → office-intro on first open.

### Sequencing

U1 catalog → U2 modal + Chat wire → U3 onboarding reuse → U4 docs. U2 depends on U1. U3 depends on U1. U4 after UX copy settles.

### Risks & Dependencies

- Risk: Naming collision with Plugins “marketplace” language. Mitigation: UI title “Hire” / “New bot”; docs call it bot marketplace; never reuse plugin catalog components for bots (R7).
- Risk: Catalog drift vs landing use-cases. Mitigation: slim shared contracts catalog; landing sync is optional follow-up, not blocking.
- Dependency: Existing optimistic hire in `apps/web/src/screens/Chat.tsx` and `apps/web/src/lib/hire.ts` must keep working with optional `title`.

### System-Wide Impact

- Instant paint: in-module catalog → no IndexedDB key required; do not add boot prefetch.
- Agent/tools: unchanged; office-intro still name-driven.
- Auth: unchanged workspace actor on `bots.create`.

## Implementation Units

### U1. Shared bot marketplace catalog

- **Goal:** Curated template data and search/filter helpers live in contracts for web (and later mobile) reuse.
- **Requirements:** R2, R5, R6, R7
- **Files:** `packages/contracts/src/bot-marketplace.ts`, `packages/contracts/src/bot-marketplace.test.ts`, `packages/contracts/src/index.ts`, `apps/web/src/lib/jobs.ts` (re-export / derive `SUGGESTED_JOBS` from catalog)
- **Approach:** Define `BotMarketplaceTemplate` (`id`, `name`, `blurb`, `category`, optional `kind: "job" | "person"`, optional `title`). Export `BOT_MARKETPLACE_CATALOG` seeded from grok-bot chips + core use-case roles. Helpers: `filterBotMarketplace(catalog, query, category)`. Export job-name list for onboarding chips. Keep blurbs short (≤160 chars display discipline like plugin cards).
- **Test scenarios:**
  - Catalog has stable unique `id`s and required fields.
  - Search matches name and blurb case-insensitively.
  - Category filter intersects with search.
  - Derived starter jobs include Chief of Staff and exclude empty names.
- **Verification:** `pnpm exec vitest run packages/contracts/src/bot-marketplace.test.ts`

### U2. Web hire marketplace modal and wire

- **Goal:** Office New bot opens marketplace; Hire and Create your own call the existing optimistic `hire` path.
- **Requirements:** R1, R2, R3, R4, R7, R8
- **Files:** `apps/web/src/components/HireMarketplaceModal.tsx` (new), `apps/web/src/components/HireDialog.tsx` (retire or reduce to Create-your-own subform), `apps/web/src/lib/hire-marketplace.ts` (new; pure view helpers), `apps/web/src/lib/hire-marketplace.test.ts`, `apps/web/src/lib/hire.ts` (pass optional `title` through `draftCreatedBot` if needed), `apps/web/src/lib/hire.test.ts`, `apps/web/src/screens/Chat.tsx`, `apps/web/src/lib/command-palette.ts` (label/keywords only if needed)
- **Approach:** Modal mirrors Plugins/Settings mount pattern (`open` prop, no mount-gated fetch). Search + category chips + template list + Hire. Create your own shows name + private. On template Hire, call existing `hire({ name, visibility, title? })` and extend `client.bots.create` args with `title` when set. Do not add remote `queryFn`. Keep dialog in the Chat tree always mounted like `PluginsModal`.
- **Test scenarios:**
  - View helper filters cards for query/category (unit).
  - `draftCreatedBot` preserves optional `title` when provided.
  - Existing hire draft/optimistic tests still pass.
- **Verification:** `pnpm exec vitest run apps/web/src/lib/hire-marketplace.test.ts apps/web/src/lib/hire.test.ts`; `pnpm --filter @groxbot/web check` if available, else web tsc via repo `pnpm check` scope used locally.

### U3. Onboarding uses shared catalog

- **Goal:** First-hire chips come from the same catalog as the office marketplace.
- **Requirements:** R5, R6
- **Files:** `apps/web/src/screens/Onboarding.tsx`, `apps/web/src/lib/jobs.ts`, optional `apps/web/src/lib/jobs.test.ts` if derivation needs coverage beyond U1
- **Approach:** Map catalog job templates to chips; picking a chip still sets name and advances to avatar step. Create your own unchanged. Prefer not changing `bots.create` payload beyond optional `title` alignment with U2.
- **Test scenarios:**
  - Chip source equals catalog-derived starter list (unit on jobs helper).
  - Existing onboarding behavior: pick job → name prefilled → create still valid (no live RPC in unit tests).
- **Verification:** `pnpm exec vitest run packages/contracts/src/bot-marketplace.test.ts apps/web/src/lib/hire.test.ts` (and jobs test if added)

### U4. Product docs alignment

- **Goal:** Docs describe bot marketplace as curated hire browse, distinct from plugins/skills.
- **Requirements:** R6, R7
- **Files:** `docs/grok-bot-ui.md`, optionally one line in `docs/caching.md` only if a new persist key is introduced (should not be)
- **Approach:** Update the job-chips sentence that forbids a “template gallery product” to describe the curated hire marketplace. State non-goals: not Plugins, not Knowledge skills. No AGENTS.md rewrite beyond what already forbids skills marketplace.
- **Test scenarios:** none (doc-only).
- **Verification:** Doc review in PR; no automated test.

## Verification Contract

- `pnpm exec vitest run packages/contracts/src/bot-marketplace.test.ts apps/web/src/lib/hire-marketplace.test.ts apps/web/src/lib/hire.test.ts`
- `pnpm check` (or targeted package check) for type errors on touched packages
- Manual smoke (optional, not default in Cloud): open New bot → search → hire → thread opens; Plugins still separate; onboarding chips match catalog names

## Definition of Done

- R1–R9 satisfied on web.
- U1–U4 complete; abandoned experiments removed from the diff.
- Hire still uses `bots.create` + home `RoomActor`; no new actor class, computers table, skills store, or plugin-catalog coupling.
- Tests listed in U1–U3 pass offline.
- `docs/grok-bot-ui.md` matches the shipped hire surface.

## Appendix

### Research breadcrumbs

- Hire UI today: `apps/web/src/components/HireDialog.tsx`, `apps/web/src/screens/Chat.tsx` (`hire`), `apps/web/src/lib/hire.ts`
- Onboarding chips: `apps/web/src/lib/jobs.ts` `SUGGESTED_JOBS`, `apps/web/src/screens/Onboarding.tsx` step 4
- Create contract: `packages/contracts/src/domain.ts` `CreateBotInput`; server `apps/api/src/bots.ts` `createBot`
- Office-intro identity: `packages/core/src/office-intro.ts` (name only)
- Plugins marketplace (do not conflate): `apps/web/src/components/PluginsModal.tsx`, `apps/web/src/lib/plugins.ts`, `docs/caching.md` plugin-catalog key
- Product reference: `docs/grok-bot-ui.md`; landing role copy: `apps/landing/src/data/use-cases.ts`
- Architecture constraints: `AGENTS.md` (no skills marketplace; RoomActor; instant paint)
