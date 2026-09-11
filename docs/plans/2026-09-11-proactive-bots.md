# Proactive bots (office `ask`, `goal.md`, Today pulse)

**Date:** 2026-09-11
**Status:** implementation-ready
**Do not start from:** Muse Goals-as-home, Cursor Project `notes.md`, a dispatcher cockpit, Paperclip, or a `tasks` table

This plan is for another agent to implement. Read it whole before editing. Match [AGENTS.md](../../AGENTS.md), [docs/rooms-plan.md](../rooms-plan.md), and [docs/computers.md](../computers.md). Do not implement from this PR.

---

## Goal

Teammates get a **Grok Bot “Suggested for you”** loop: the bot messages **its own office** with one parked `ask` card (pitch + Yes / No). Yes continues the turn. No drops it. Fuel is that bot’s computer file `goal.md`. Proof is that bot’s computer file `activity.md`. The company glance is a derived **Today** pulse (`Stripe Buddy · has an idea`), not a shared org file.

Stop when:

- A bot with a goal on the desk can, on a clock, put **one** Yes/No idea in its 1:1 office and wait.
- New hires stay quiet until a human writes **or** `goal.md` exists.
- Yes never silently send / spend / hire / publish.
- There is no Goals chrome tab, no `tasks` table, no `notes.md` product file, no org `activity.md`.

---

## Why (the mix)

Walk-in should feel like a **team**: people, rooms, proof of work. Today the office is reactive. New hires open on an empty desk (`OfficeWelcome` in `apps/web/src/components/OfficeThread.tsx`) and stay quiet until a human sends. Routines already fire (`runScheduledRoutine` → `appendOfficeUserAndRun`). Idle Learned already files after tool work (`runOfficeReviewTurn`). `ask` already parks a live turn (`OfficeAskBoard` + `AskToolUI`). Hire approval (PR 105) already parks a Code Mode execute until Hire / Don't hire (`OfficeApprovalBoard` + `OfficeApprovalCard`).

What is missing is the **proactive** shape:

| Piece | Today | Target |
|---|---|---|
| Clock | Human send, routine kick (visible user row, **forbids ask**), idle Learned (hidden kick, Skip stays off the log) | Desk-check **schedule** on the home `RoomActor`; idle Learned stays filing-only |
| Pitch | Model may `ask` only while Cap’n Web is live; unattended → skip | Parked Yes/No card survives the human being away (copy hire park) |
| Fuel | Soul / memory via `set_context`; no standing-aims file | Computer `goal.md` |
| Proof | Thread + optional Learned line | Computer `activity.md` (this bot, not the library) |
| Company glance | Roster `lastPreview` from the last chat line | Derived pulse: `Name · has an idea` when an ask is parked |

Do not solve this by becoming Muse (Goals tab as home), a Cursor coordinator (`notes.md` + subagent swarm), or Paperclip (org task graph).

---

## Locked product

1. **Team-first.** Home is people, rooms, and proof. Not personal Goals. Not a dispatcher.
2. **1:1 only.** The bot posts the card in **its home office** (`bots.homeRoomId`). Not a group room, not poke, not a workspace feed.
3. **One idea at a time per bot.** No blast. If an ask is already parked, later desk-checks no-op.
4. **Ask card.** Pitch plus Yes / No. Park the turn like hire approval. Yes continues Pi on the same turn. No skips / drops it.
5. **Fuel / proof.** `goal.md` = standing aims. `activity.md` = what this person actually did. Do **not** require `notes.md`.
6. **Quiet new hires.** Empty desk until the human writes **or** `goal.md` is on the computer. Do not seed an empty `goal.md` on hire (that would un-quiet them).
7. **Never auto-run send / spend / hire / publish.** Cute avatars ≠ silent side effects. Existing Code Mode `requiresApproval` stays. Yes on an idea means “work this,” not “wire money.”
8. **Clocks we already have.** Home `RoomActor` `this.schedule` / `listSchedules` / `cancelSchedule` (`cf_agents_schedules`) and idle Learned snapshot turns. Reuse those. No `tasks` table. No Goals chrome tab.

---

## Non-goals (do not do these)

- Do **not** add a product file `notes.md` (Cursor Project convention). Knowledge `notes.md` and computer scratch files may exist; they are not this feature.
- Do **not** add a workspace / org `activity.md` on R2 or D1.
- Do **not** add a `tasks` table, D1 jobs catalog, or Tonbo / baerly.
- Do **not** add a subagent swarm, `AgentSpawner` people, or Paperclip orchestration.
- Do **not** add `BotActor`, a `computers` table, a Computer Durable Object, or a second filesystem inside Code Mode.
- Do **not** put goal / activity in Knowledge (R2). The library is playbooks. Standing aims and proof live on **this** computer.
- Do **not** start a proactive turn from idle Learned. Learned stays: hidden kick, file playbook/soul/memory, one Learned line or Skip.
- Do **not** add an inbound-mail / plugin event bus as the v1 wake. Mail can be fuel the model reads **during** a desk-check if a plugin is already connected. It does not start the turn.
- Do **not** fight empty-desk: no hidden office-intro, no hire-time pitch, no seed `goal.md`.
- Do **not** call live OpenRouter / grox-gateway / Computer / TinyFish in tests. `ScriptedAgentRuntime` only.

---

## Target architecture

```
home RoomActor (name = homeRoomId)
──────────────────────────────────
Computer Workspace          Pi Session (DO SQLite)
  /workspace/goal.md          office log + parked ask
  /workspace/activity.md      Cap’n Web /rooms/:roomId/rpc

this.schedule ──desk-check──▶ hidden kick (off the log)
                               read goal.md / activity.md
                               if one idea: top-level ask (Yes / No)
                               else: Skip (quiet)

idle Learned snapshot ──▶ may append activity.md; never pitches

roster / Today (Phase C) ── derived from parked ask + lastPreview
                               not a shared file
```

D1 stays the shared-team catalog (auth, roster, rooms). Office transcript stays Pi on the home actor. Knowledge stays R2. Computer files stay DO SQLite VFS (`@cloudflare/computer` `Workspace`, cwd `/workspace`).

### What actually starts a proactive turn

| Clock | Starts a pitch? | Why |
|---|---|---|
| **Desk-check schedule** (`this.schedule` on home) | **Yes — the only v1 wake** | Same Agents clock as routines, different callback. Hidden kick. Allowed to `ask`. |
| **Idle Learned** (`runOfficeReviewTurn`) | **No** | After ~15 settled tool parts. Kick off the log. Skip stays quiet. May append `activity.md` if the stretch produced proof. |
| **Human send** | No (reactive) | First human write can *un-quiet* and may cause the bot to write `goal.md`. Not a proactive pitch. |
| **Existing human routine** (`runScheduledRoutine`) | **No** | Visible user kick; system prompt currently **forbids ask** (`OFFICE_ROUTINE_KICK_INSTRUCTIONS`). Leave that path alone. |
| **Mail / plugin event** | **No (v1)** | No inbound wake today. Do not add one. A later trigger may enqueue the **same** desk-check; not a new product clock. |

Host safety on every desk-check fire (before Pi):

1. No `goal.md` **and** no human user row in the office session → return. Empty desk stays empty.
2. A parked `ask` already waiting → return. One idea at a time.
3. Office turn already running → do not enqueue a second loop.

Default cadence: **once per day** (workspace timezone if you have it, else UTC). Not every few minutes. The human can pause the desk-check via existing routines pause (parks the payload in DO storage).

Do **not** auto-create `goal.md`. Do **ensure** one desk-check schedule once `goal.md` exists (host-side, first write or first successful read). The model may change cadence with `routines.update` later; it must not be the only way the clock appears.

### Why not `runScheduledRoutine` as-is

`formatRoutinePrompt` + `withOfficeRoutineKick` tell the model this is a scheduled job, to execute with tools, and **not** to ask clarifying questions. A “Suggested for you” card **is** an ask. Reusing that callback would fight the routine product.

Add a reserved callback (name bikeshed: `runDeskCheck`) on the same `RoomActor`, same `cf_agents_schedules` table. Kick text stays off the office log (copy `runOfficeReviewTurn` / `officeReviewUserText`). If the model has no idea, reply `Skip` (same token as Learned) and stay quiet. If it pitches, the visible artifact is the `ask` card, not a cron bubble.

---

## UX

### 1:1 ask card

In that bot’s office thread, an `ask` card:

- Short pitch (what they want to do and why it serves `goal.md`).
- Two options: **Yes** / **No** (labels can be “Yes, do it” / “No”).
- Parked in the transcript like hire (`OfficeApprovalCard`): not a composer footer, not a toast.
- Yes → `OfficeAskBoard.answer` unblocks the same Pi `execute`; the model continues (research, draft, write `activity.md`). Send / spend / hire / publish still need their own approvals.
- No → skip; optional one-line `activity.md` append (“skipped: …”). No follow-up nag this tick.
- Away from the socket: the card stays parked. Opening the office shows it. Current `ask` returning `officeAskSkipped("unattended")` when `!this.live` is **wrong** for this loop — that is Phase B.

Copy voice: teammate with an idea, not “agent run.” Example: “I could draft three outbound mails from this week’s shortlist. Nothing sends until you say so.”

### Roster / Today snippet

Needs-attention already belongs on the list ([docs/grok-bot-ui.md](../grok-bot-ui.md): question, approval, handoff). Phase C makes the glance:

`Stripe Buddy · has an idea`

Derived. Instant paint from last-known Query / IndexedDB (`docs/caching.md`). Do not fan-out `read()` of every computer on `bots.list`.

Until Phase C, a parked ask still shows in the open thread; roster may keep using `lastPreview` from chat. Do not block A/B on Today.

### Empty desk vs first goal

| State | UI | Proactive |
|---|---|---|
| New hire, no human rows, no `goal.md` | Empty desk copy (job description or first task) | No desk-check fire |
| Human wrote in the thread | Normal office | Bot should write/update `goal.md` from that job; host may then schedule desk-check |
| `goal.md` exists (human wrote it on the computer **or** bot filed it) | Office as today; empty-state can mention a goal on the desk | Desk-check may fire (still one idea, still Skip if nothing to pitch) |
| Parked ask | Card in thread | Further ticks no-op |

Do not run a hidden office-intro to invent a goal. `subscribeOffice` already skips that (`OFFICE_INTRO_STORAGE`). Keep it.

Composer placeholder can grow from “Job description or first task” to also mention a `goal.md` on their computer. That is copy, not a new surface.

---

## Data files

Computer cwd is `/workspace` ([docs/computers.md](../computers.md), `COMPUTER_VFS_ROOT`). Paths:

| File | Role | Who writes |
|---|---|---|
| `/workspace/goal.md` | Standing aims. Short. What this person owns. | Human (computer pane or a chat the bot files) or the bot via `write` / `edit` after a job description. **Host does not seed.** |
| `/workspace/activity.md` | Proof log. Newest first or dated appends. What actually happened. | Bot after real work (human task, Yes-on-idea, or Learned that filed). Human may edit. |

Resolve `goal.md` the same way other computer files do (`computerVfsPaths`: `goal.md` and `/workspace/goal.md`). Do not put these under `inbox/` (inbox is not under `/workspace`).

**Not Knowledge.** `knowledge.write` is the office library. Do not dual-write goal/activity there. File chips may `present` a computer File (`place: computer`) if the human should see the proof — optional, not required for v1.

### How the model is prompted

When computer FS tools are on the turn, `buildOfficeSystemPrompt` (`packages/core/src/office-system-prompt.ts`) gains a guideline, roughly:

- Standing aims live in `goal.md` on this computer. Proof lives in `activity.md`. Read them. Keep them true. Do not invent a parallel notes file as the product.
- After a job description or first task, write or update `goal.md`. After real work, append `activity.md`.
- One idea at a time. To pitch, call top-level `ask` with Yes / No. Do not send / spend / hire / publish without approval even if they said Yes to the idea.
- Empty desk: if there is no human work and no `goal.md`, do not pitch.

Desk-check system overlay (like `<scheduled_job>`, but a distinct tag, e.g. `<desk_check>`):

- This is not a human message. Never mention the kick.
- Read `goal.md` then recent `activity.md`.
- If you have **one** concrete idea that serves the goal and is not already in flight, `ask` with Yes / No. Stay in the office. Do not email/send/spend/hire/publish on this tick unless they already approved that tool this turn.
- If nothing is worth asking, reply exactly `Skip`.

Idle Learned prompt may add: if you filed a playbook/soul/memory, also append one line to `activity.md`. Still Skip if nothing belongs. Still no pitch.

### Convention, not a schema server

No parser product. Markdown the bot and the human can edit. Suggested shape (directional, not a validator):

```markdown
# Goal
Own outbound for the Sept hire. Draft, never send.

# Now
Shortlist is in the thread. Next: three draft mails.
```

```markdown
# Activity
- 2026-09-11: Parked ask — three draft mails from the shortlist.
- 2026-09-10: Eight names + why. Nobody emailed.
```

Reject a structured D1/JSON goals API.

---

## Wake path (implementer)

```
computer write("goal.md") or first human office user
        │
        ▼
ensureDeskCheckSchedule()     // this.schedule, callback runDeskCheck, daily
        │
        ▼
runDeskCheck()
  gates: goal.md or human row? parked ask? turn busy?
  no  → return
  yes → hidden user kick + runPiTurn (ScriptedAgentRuntime in tests)
        ├─ ask(Yes/No) → park (durable, even if !live)
        └─ Skip        → nothing on the log
```

Reuse `enqueueTurn`. Reuse `officeReviewAnnounce` / Skip hiding in projection (`isOfficeReviewSkip` / `isVisibleChatMessage`). Desk-check Skip must stay off the thread the same way.

Parked ask: extend `OfficeAskBoard` so a desk-check (or all office asks) **do not** `officeAskSkipped("unattended")` when nobody is subscribed. Persist waiter in DO storage if the isolate may sleep — hire park is in-memory on the live `code` execute; desk-check must survive a restart. Prefer: serialize the pending `OfficeAskPrompt` in `this.ctx.storage`, rehydrate on alarm/subscribe, and keep the Pi tool execute blocked (or resume via a continuation) until Yes / No.

If persisting a live Pi `execute` across DO hibernation is too sharp for v1, the allowed fallback is: finish the desk-check tool with a durable “parked idea” record, render the same `ask` card from storage, and on Yes enqueue a **continuation** turn (“They said yes to: …”) that is not a new idea. That is still one idea, still Yes continues / No drops. Do not invent a second tool name; the UI stays `ask`.

`enterLive` / `leaveLive` stay for *in-conversation* clarifying asks if you keep unattended-skip there. Proactive park is a different waiter class or a flag on the prompt (`source: "desk-check"`). Pick one implementation; do not ship two Yes/No widgets.

---

## Safety

- **Ask-before-act.** Desk-check must not call send/spend/hire/publish tools before Yes. After Yes, those tools still use existing approval cards.
- **Rate.** One parked ask per home room. Daily tick. Skip if busy or parked.
- **Empty desk.** Host gate, not only prompt. No `goal.md` + no human user → no Pi.
- **Do not seed** `goal.md` or run intro to create fuel.
- **Pause.** Existing routines pause must be able to stop the desk-check. No zombie ticks.
- **Unattended.** Do not treat “no socket” as No. Park.
- **Group / poke.** Desk-check never posts to a group log or a poke thread.

---

## Current files the implementer will touch

### Convention + prompt (Phase A)

- `packages/core/src/office-system-prompt.ts` — computer guideline for `goal.md` / `activity.md`; desk-check overlay helper
- `packages/core/src/office-system-prompt.test.ts`
- `packages/core/src/office-review.ts` — optional `activity.md` line when Learned files; still no pitch
- `apps/api/src/bot-actor.ts` — `ensureDeskCheckSchedule` after computer write of `goal.md`; `runDeskCheck`; empty-desk gate
- `apps/web/src/components/OfficeThread.tsx` — empty-desk copy
- `apps/web/src/screens/Chat.tsx` — composer placeholder

### Parked ask (Phase B)

- `packages/core/src/office-ask.ts` — durable park, Yes/No helpers, skip reasons
- `apps/api/src/bot-ask.ts` — `OfficeAskBoard` (today skips unattended)
- `apps/api/src/bot-approval.ts` — pattern to copy (`OfficeApprovalBoard.wait` / `resume`)
- `apps/api/src/bot-office-rpc.ts` — already has ask answer/skip + `approveApproval`
- `apps/web/src/components/AskToolUI.tsx` — card already exists; Yes/No copy
- `apps/web/src/components/OfficeApprovalCard.tsx` — visual sibling, not a second widget
- `packages/core/src/routines.ts` — **do not** weaken `OFFICE_ROUTINE_KICK_INSTRUCTIONS` for ordinary routines

### Today pulse (Phase C)

- `apps/web/src/lib/bot-preview.ts`, `apps/web/src/lib/chat-messages.ts` / `packages/core/src/pi-projection.ts` — `lastProjectedPreview`
- Roster row in `apps/web/src/screens/Chat.tsx`
- Optional: when ask parks, patch `lastPreview` to `has an idea` (D1 `bots.lastPreview` already exists). No new column required if the actor already updates preview.

### Stay

- Computer VFS / `write` / `read` / `edit`
- `ScriptedAgentRuntime` / `runPiTurn`
- D1 roster (PR 106). Do not put goal text in D1.
- Knowledge R2, Skills store, marketplace catalog

---

## Invariants (lock these)

1. **Instance name is `roomId`.** Desk-check runs on the home `RoomActor`. Never a `BotActor`.
2. **Computer is the store.** `goal.md` / `activity.md` are Workspace files. Knowledge is not a backup of them.
3. **One parked idea per home room.** Host-enforced.
4. **Yes continues, No drops.** Same turn or an explicit continuation of that ask — not a fresh brainstorm.
5. **Skip is silent.** Desk-check Skip never becomes a chat bubble.
6. **Empty desk until fuel.** Host gate + no seed file.
7. **Approvals still exist** for hire/send/spend/delete/publish after Yes.
8. **Tests offline.** No live model, Computer, or TinyFish.

---

## Phases

Ship in order. A/B before C. Each phase leaves `pnpm test` / targeted vitest green.

### Phase A — Convention + prompt

The office already has a computer and a clock. Teach the files and the empty-desk rule. Wire `ensureDeskCheckSchedule` + `runDeskCheck` with Skip-if-nothing. **Do not require a durable away-ask yet** if the human is in the office; still skip unattended rather than blasting. Prefer shipping the host gates in A so empty desks cannot fire.

Acceptance: scripted desk-check with no `goal.md` and no human row does not call the model. With `goal.md`, a scripted model that replies `Skip` writes nothing to the session. System prompt mentions `goal.md` / `activity.md`. Hire still opens an empty desk with no `goal.md`.

### Phase B — Parked ask card

Durable Yes/No. Copy hire park UX. One idea. Yes continues work; No drops. Unattended parks. Card in the thread (`AskToolUI`). Do not auto-send.

Acceptance: scripted desk-check calls `ask` with Yes/No; no subscriber; waiter still pending; subscribe paints the card; Yes resumes; a second desk-check while parked is a no-op. No live APIs.

### Phase C — Today pulse

Roster / Today snippet derived from parked ask (`Name · has an idea`). Instant paint. Not a shared org file. Ship after A/B.

---

## Tests (offline only)

| Case | Assert |
|---|---|
| System prompt with computer FS tools | mentions `goal.md` and `activity.md`; does not require `notes.md` |
| Empty desk gate | `runDeskCheck` with no files and no human user → no `runPiTurn` |
| First `goal.md` write | schedules one desk-check; second write does not duplicate |
| Desk-check Skip | no office log row (projection hides Skip) |
| Parked ask, unattended | not `skipped: unattended`; pending survives |
| Yes | continues the same idea; still cannot publish without approval |
| No | waiter gone; no send; optional activity append |
| Second tick while parked | no second Pi turn |
| Ordinary routine kick | still forbids clarifying `ask`; unchanged |
| Idle Learned | can mention `activity.md`; does not call `ask` in the review user text |
| `ScriptedAgentRuntime` | scripted tool results only |

Web: extend `apps/web/src/lib/ask-ui.test.ts` for Yes/No desk-check copy. Phase C: `bot-preview` / sidebar tests for `has an idea` without waiting on a computer read.

Do not start `computerUse` / headed browser unless asked.

---

## Suggested PR slices

1. **Prompt + host gates + `runDeskCheck` Skip path** (Phase A) — no user-visible pitch yet, but empty desks stay quiet
2. **Durable parked `ask` + Yes/No** (Phase B) — the product
3. **Today pulse** (Phase C) — roster snippet only

Do not land C on a world where unattended asks still skip.

---

## Acceptance checklist

- [ ] Desk-check is `this.schedule` on the home `RoomActor`, not a `tasks` table, not Worker Cron, not idle Learned
- [ ] `goal.md` / `activity.md` are computer paths; Knowledge is untouched as the store
- [ ] New hire: no seed `goal.md`, no pitch, empty-desk copy still true
- [ ] Human write **or** `goal.md` un-quiets; one idea at a time
- [ ] Parked ask card in the 1:1 office; Yes continues; No drops
- [ ] Unattended does not mean No
- [ ] Send / spend / hire / publish still need approval after Yes
- [ ] Today pulse (when shipped) is derived; no org `activity.md`
- [ ] `rg` does not grow `BotActor`, `computers` table, or Code Mode dual FS
- [ ] `pnpm test` / targeted vitest; `ScriptedAgentRuntime` only

---

## Implementer notes

- Hire approval (PR 105) is the parked-turn **UX** to copy, not the tool. The tool is still top-level `ask` (PR 99). Do not route a proactive idea through `bots.hire` or generic `Approve ${connector}.${method}`.
- Catalog is D1 (PR 106). That does not make D1 the activity store. `bots.lastPreview` is a fine pulse cache; goal text is not a D1 column.
- `OfficeAskBoard.enterLive` is tied to `subscribeOffice`. Proactive exists so the bot can speak **before** they open the thread. Design the waiter for that.
- If `goal.md` is written only via `shell` (`echo > goal.md`) and not `write`, still detect it on the next desk-check by `read`; the ensure-schedule hook should watch computer `write` / `edit` first, and treat a successful desk-check `read` of a new file as the backup ensure.
- Group rooms: no desk-check. A seated guest must not pitch in the group from this clock.
- When in doubt, prefer quiet. A missed idea is better than a blast.
