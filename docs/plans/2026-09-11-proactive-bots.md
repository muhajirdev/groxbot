# Proactive bots (office `ask`, `goal.md`, Today pulse)

**Date:** 2026-09-11
**Status:** implementation-ready
**Do not start from:** Muse Goals-as-home, Cursor Project `notes.md`, a dispatcher cockpit, Paperclip, or a `tasks` table

This plan is for another agent to implement. Read it whole before editing. Match [AGENTS.md](../../AGENTS.md), [docs/rooms-plan.md](../rooms-plan.md), and [docs/computers.md](../computers.md). Do not implement from this PR.

---

## Goal

Teammates get a **Grok Bot “Suggested for you”** loop: the bot messages **its own office** with one parked `ask` card. No goal yet → “What should I own?” Has a goal → pitch + Yes / No. Fuel is that bot’s computer file `goal.md`. Proof is that bot’s computer file `activity.md`. The company glance is a derived **Today** pulse (`Stripe Buddy · has an idea` or `needs a goal`), not a shared org file.

Stop when:

- A bot **without** `goal.md` asks once what it should own (parked card). It does not invent work.
- A bot **with** a goal can, on a clock, put **one** Yes/No idea in its 1:1 office and wait.
- Yes never silently send / spend / hire / publish.
- There is no Goals chrome tab, no `tasks` table, no `notes.md` product file, no org `activity.md`.

---

## Why (the mix)

Walk-in should feel like a **team**: people, rooms, proof of work. Today the office is reactive. New hires open on an empty desk (`OfficeWelcome` in `apps/web/src/components/OfficeThread.tsx`) and stay silent until a human sends. Routines already fire (`runScheduledRoutine` → `appendOfficeUserAndRun`). Idle Learned already files after tool work (`runOfficeReviewTurn`). `ask` already parks a live turn (`OfficeAskBoard` + `AskToolUI`). Hire approval (PR 105) already parks a Code Mode execute until Hire / Don't hire (`OfficeApprovalBoard` + `OfficeApprovalCard`).

What is missing is the **proactive** shape: without a goal they should ask what to own; with a goal they may pitch one idea.

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
3. **One card at a time per bot.** No blast. If an ask is already parked, later desk-checks no-op.
4. **Ask card.** Two shapes, same widget. **No `goal.md`:** “What should I own?” (a sentence, a few bullets, optional job chips). **Has a goal:** pitch plus Yes / No. Park like hire approval. Answering continues Pi; Skip / No drops it.
5. **Fuel / proof.** `goal.md` = standing aims. `activity.md` = what this person actually did. Do **not** require `notes.md`.
6. **No goal → ask for a goal.** Do not invent tasks without fuel. Do not seed an empty `goal.md` on hire. Empty-desk copy can stay; the card is how they set the job. No hidden office-intro essay.
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
- Do **not** run a hidden office-intro or seed `goal.md`. Asking “what should I own?” is the allowed first card. Do not invent work without a goal.
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
                               no goal.md → ask “what should I own?”
                               else read goal.md / activity.md
                               if one idea: ask (Yes / No)
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
| **Human send** | No (reactive) | Composer still works. If they type a job instead of tapping the card, the bot files `goal.md`. |
| **Existing human routine** (`runScheduledRoutine`) | **No** | Visible user kick; system prompt currently **forbids ask** (`OFFICE_ROUTINE_KICK_INSTRUCTIONS`). Leave that path alone. |
| **Mail / plugin event** | **No (v1)** | No inbound wake today. Do not add one. A later trigger may enqueue the **same** desk-check; not a new product clock. |

Host safety on every desk-check fire (before Pi):

1. A parked `ask` already waiting → return. One card at a time.
2. Office turn already running → do not enqueue a second loop.
3. Last goal-ask was **skipped** and still no `goal.md` and no new human user row → return (no daily nag). A later human message or a long backoff (implementer: ≥ 7 days) may try once more.
4. No `goal.md` otherwise → **still run**. The only allowed tool outcome is `ask` for a goal — not a work pitch, not send/spend/hire.

Default cadence: **once per day** after the first tick (workspace timezone if you have it, else UTC). **First tick does not wait a day** — `ensureDeskCheckSchedule` on hire (and on first office open if the schedule is missing) so a new hire can see “What should I own?” soon. The human can pause the desk-check via existing routines pause.

Do **not** auto-create `goal.md`. Do **ensure** one desk-check schedule on hire. The model may change cadence with `routines.update` later; it must not be the only way the clock appears.

### Why not `runScheduledRoutine` as-is

`formatRoutinePrompt` + `withOfficeRoutineKick` tell the model this is a scheduled job, to execute with tools, and **not** to ask clarifying questions. A “Suggested for you” card **is** an ask. Reusing that callback would fight the routine product.

Add a reserved callback (name bikeshed: `runDeskCheck`) on the same `RoomActor`, same `cf_agents_schedules` table. Kick text stays off the office log (copy `runOfficeReviewTurn` / `officeReviewUserText`). If there is no `goal.md`, the visible artifact is an `ask` for a goal. If there is a goal and nothing to pitch, reply `Skip` and stay quiet. If there is a goal and one idea, the artifact is a Yes/No `ask`. Never a cron bubble.

---

## UX

### 1:1 ask card

In that bot’s office thread, an `ask` card. Same widget, two jobs:

**No `goal.md` — ask for a goal**

- Prompt like: “What should I own? A sentence or a few bullets is enough.”
- Optional short chips (marketplace job names) plus they can type in the composer.
- Skip = not now. Do not invent a goal. Do not nag the next morning.
- If they answer (card or a normal message), the bot writes `goal.md`. That is fuel, not a seed file.

**Has `goal.md` — pitch an idea**

- Short pitch (what they want to do and why it serves `goal.md`).
- Two options: **Yes** / **No** (labels can be “Yes, do it” / “No”).
- Yes → unblocks the same Pi `execute`; the model continues (research, draft, write `activity.md`). Send / spend / hire / publish still need their own approvals.
- No → skip; optional one-line `activity.md` append (“skipped: …”). No follow-up nag this tick.

Both: parked in the transcript like hire (`OfficeApprovalCard`); survives the human being away. Current `ask` returning `officeAskSkipped("unattended")` when `!this.live` is **wrong** for this loop — that is Phase B.

Copy voice: teammate, not “agent run.” Goal-ask: “What should I own?” Idea: “I could draft three outbound mails from this week’s shortlist. Nothing sends until you say so.”

### Roster / Today snippet

Needs-attention already belongs on the list ([docs/grok-bot-ui.md](../grok-bot-ui.md): question, approval, handoff). Phase C makes the glance:

`Stripe Buddy · has an idea` (parked work pitch) or `Stripe Buddy · needs a goal` (parked goal-ask). Same derived glance, two copy strings.

Derived. Instant paint from last-known Query / IndexedDB (`docs/caching.md`). Do not fan-out `read()` of every computer on `bots.list`.

Until Phase C, a parked ask still shows in the open thread; roster may keep using `lastPreview` from chat. Do not block A/B on Today.

### Empty desk vs first goal

| State | UI | Proactive |
|---|---|---|
| New hire, no `goal.md` | Empty desk copy plus a parked “What should I own?” card | Desk-check **does** fire; only a goal-ask, never a work pitch |
| Goal-ask skipped | Empty desk; no card | No daily nag until they write or ≥ 7 days |
| Human wrote in the thread (no `goal.md` yet) | Normal office | Bot writes/updates `goal.md` from that job |
| `goal.md` exists | Office as today | Desk-check may pitch one Yes/No idea, or Skip |
| Parked ask | Card in thread | Further ticks no-op |

Do not run a hidden office-intro to invent a goal. `subscribeOffice` already skips that (`OFFICE_INTRO_STORAGE`). Keep it. The goal-ask is a parked `ask`, not a secret user bubble.

Composer placeholder can stay “Job description or first task.” The card is the same ask.

---

## Data files

Computer cwd is `/workspace` ([docs/computers.md](../computers.md), `COMPUTER_VFS_ROOT`). Paths:

| File | Role | Who writes |
|---|---|---|
| `/workspace/goal.md` | Standing aims. Short. What this person owns. | Human (computer pane, composer, or the goal-ask) or the bot via `write` / `edit` after they answer. **Host does not seed.** |
| `/workspace/activity.md` | Proof log. Newest first or dated appends. What actually happened. | Bot after real work (human task, Yes-on-idea, or Learned that filed). Human may edit. |

Resolve `goal.md` the same way other computer files do (`computerVfsPaths`: `goal.md` and `/workspace/goal.md`). Do not put these under `inbox/` (inbox is not under `/workspace`).

**Not Knowledge.** `knowledge.write` is the office library. Do not dual-write goal/activity there. File chips may `present` a computer File (`place: computer`) if the human should see the proof — optional, not required for v1.

### How the model is prompted

When computer FS tools are on the turn, `buildOfficeSystemPrompt` (`packages/core/src/office-system-prompt.ts`) gains a guideline, roughly:

- Standing aims live in `goal.md` on this computer. Proof lives in `activity.md`. Read them. Keep them true. Do not invent a parallel notes file as the product.
- After a job description or first task (or an answer to the goal-ask), write or update `goal.md`. After real work, append `activity.md`.
- One card at a time. No `goal.md`: `ask` what to own. Do not invent work. With a goal: `ask` Yes / No for one idea. Do not send / spend / hire / publish without approval even if they said Yes to the idea.

Desk-check system overlay (like `<scheduled_job>`, but a distinct tag, e.g. `<desk_check>`):

- This is not a human message. Never mention the kick.
- Read `goal.md` then recent `activity.md`.
- If `goal.md` is missing, `ask` what you should own. Do not invent a job. Do not pitch work.
- If you have a goal and **one** concrete idea that is not already in flight, `ask` with Yes / No. Stay in the office. Do not email/send/spend/hire/publish on this tick unless they already approved that tool this turn.
- If you have a goal and nothing is worth asking, reply exactly `Skip`.

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
hire (or first office open if schedule missing)
        │
        ▼
ensureDeskCheckSchedule()     // this.schedule, callback runDeskCheck
        │                     // first tick soon; then daily
        ▼
runDeskCheck()
  gates: parked ask? turn busy? goal-ask recently skipped?
  no  → return
  yes → hidden user kick + runPiTurn (ScriptedAgentRuntime in tests)
        ├─ no goal.md → ask “what should I own?” (park)
        ├─ goal.md + idea → ask(Yes/No) → park
        └─ goal.md + nothing → Skip (quiet)
```

Reuse `enqueueTurn`. Reuse `officeReviewAnnounce` / Skip hiding in projection (`isOfficeReviewSkip` / `isVisibleChatMessage`). Desk-check Skip must stay off the thread the same way.

Parked ask: extend `OfficeAskBoard` so a desk-check (or all office asks) **do not** `officeAskSkipped("unattended")` when nobody is subscribed. Persist waiter in DO storage if the isolate may sleep — hire park is in-memory on the live `code` execute; desk-check must survive a restart. Prefer: serialize the pending `OfficeAskPrompt` in `this.ctx.storage`, rehydrate on alarm/subscribe, and keep the Pi tool execute blocked (or resume via a continuation) until Yes / No.

If persisting a live Pi `execute` across DO hibernation is too sharp for v1, the allowed fallback is: finish the desk-check tool with a durable “parked idea” record, render the same `ask` card from storage, and on Yes enqueue a **continuation** turn (“They said yes to: …”) that is not a new idea. That is still one idea, still Yes continues / No drops. Do not invent a second tool name; the UI stays `ask`.

`enterLive` / `leaveLive` stay for *in-conversation* clarifying asks if you keep unattended-skip there. Proactive park is a different waiter class or a flag on the prompt (`source: "desk-check"`). Pick one implementation; do not ship two Yes/No widgets.

---

## Safety

- **Ask-before-act.** Desk-check must not call send/spend/hire/publish tools before Yes. After Yes, those tools still use existing approval cards. No `goal.md` → no work tools, only the goal-ask.
- **Rate.** One parked ask per home room. Daily tick after the first. Skip if busy or parked. Goal-ask Skip does not come back the next morning.
- **No seed.** Host never writes `goal.md`. The bot writes it after they answer or type a job.
- **Pause.** Existing routines pause must be able to stop the desk-check. No zombie ticks.
- **Unattended.** Do not treat “no socket” as No. Park.
- **Group / poke.** Desk-check never posts to a group log or a poke thread.

---

## Current files the implementer will touch

### Convention + prompt (Phase A)

- `packages/core/src/office-system-prompt.ts` — computer guideline for `goal.md` / `activity.md`; desk-check overlay helper
- `packages/core/src/office-system-prompt.test.ts`
- `packages/core/src/office-review.ts` — optional `activity.md` line when Learned files; still no pitch
- `apps/api/src/bot-actor.ts` — `ensureDeskCheckSchedule` on hire; `runDeskCheck`; no-goal → goal-ask, skip-nag gate
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
- Optional: when ask parks, patch `lastPreview` to `has an idea` or `needs a goal` (D1 `bots.lastPreview` already exists). No new column required if the actor already updates preview.

### Stay

- Computer VFS / `write` / `read` / `edit`
- `ScriptedAgentRuntime` / `runPiTurn`
- D1 roster (PR 106). Do not put goal text in D1.
- Knowledge R2, Skills store, marketplace catalog

---

## Invariants (lock these)

1. **Instance name is `roomId`.** Desk-check runs on the home `RoomActor`. Never a `BotActor`.
2. **Computer is the store.** `goal.md` / `activity.md` are Workspace files. Knowledge is not a backup of them.
3. **One parked card per home room.** Host-enforced. Goal-ask and idea-ask share that slot.
4. **Answer continues, Skip / No drops.** Same turn or an explicit continuation of that ask — not a fresh brainstorm.
5. **Skip is silent** when they have a goal and nothing to pitch. A goal-ask Skip is “not now,” not a chat bubble.
6. **No `goal.md` → ask for a goal, never invent work.** Host + prompt. No seed file.
7. **Approvals still exist** for hire/send/spend/delete/publish after Yes.
8. **Tests offline.** No live model, Computer, or TinyFish.

---

## Phases

Ship in order. A/B before C. Each phase leaves `pnpm test` / targeted vitest green.

### Phase A — Convention + prompt

The office already has a computer and a clock. Teach the files. Wire `ensureDeskCheckSchedule` on hire + `runDeskCheck`. Without `goal.md`, the scripted path is a goal-ask (may still skip unattended in A). With `goal.md` and nothing to do, Skip. Prefer shipping the host gates in A so a skipped goal-ask cannot nag daily.

Acceptance: hire with no `goal.md` schedules a desk-check. Scripted desk-check with no `goal.md` calls `ask` for a goal (or parks it). Skip on that card does not fire again the next day. With `goal.md`, a scripted `Skip` writes nothing to the session. System prompt mentions `goal.md` / `activity.md`. No seed `goal.md`.

### Phase B — Parked ask card

Durable park. Copy hire park UX. Goal-ask without `goal.md`; Yes/No when there is a goal. Unattended parks. Card in the thread (`AskToolUI`). Do not auto-send.

Acceptance: scripted desk-check with no `goal.md` parks “What should I own?” with no subscriber; answering writes `goal.md`. With a goal, `ask` Yes/No parks; Yes resumes; a second desk-check while parked is a no-op. No live APIs.

### Phase C — Today pulse

Roster / Today snippet derived from parked ask (`Name · has an idea` or `needs a goal`). Instant paint. Not a shared org file. Ship after A/B.

---

## Tests (offline only)

| Case | Assert |
|---|---|
| System prompt with computer FS tools | mentions `goal.md` and `activity.md`; does not require `notes.md` |
| Hire, no `goal.md` | one desk-check schedule exists |
| No `goal.md` desk-check | model is asked to `ask` for a goal; must not pitch work or send |
| Goal-ask Skip | no daily re-fire until human write or ≥ 7 days |
| First `goal.md` write (after they answer) | file exists; still one schedule, not a second |
| Desk-check Skip (has goal, nothing to do) | no office log row (projection hides Skip) |
| Parked ask, unattended | not `skipped: unattended`; pending survives |
| Yes on an idea | continues the same idea; still cannot publish without approval |
| No on an idea | waiter gone; no send; optional activity append |
| Second tick while parked | no second Pi turn |
| Ordinary routine kick | still forbids clarifying `ask`; unchanged |
| Idle Learned | can mention `activity.md`; does not call `ask` in the review user text |
| `ScriptedAgentRuntime` | scripted tool results only |

Web: extend `apps/web/src/lib/ask-ui.test.ts` for Yes/No desk-check copy. Phase C: `bot-preview` / sidebar tests for `has an idea` without waiting on a computer read.

Do not start `computerUse` / headed browser unless asked.

---

## Suggested PR slices

1. **Prompt + host gates + `runDeskCheck`** (Phase A) — hire schedules the clock; no-goal path is a goal-ask; Skip-nag gated
2. **Durable parked `ask`** (Phase B) — goal-ask + Yes/No idea, unattended park
3. **Today pulse** (Phase C) — `has an idea` / `needs a goal`

Do not land C on a world where unattended asks still skip.

---

## Acceptance checklist

- [ ] Desk-check is `this.schedule` on the home `RoomActor`, not a `tasks` table, not Worker Cron, not idle Learned
- [ ] `goal.md` / `activity.md` are computer paths; Knowledge is untouched as the store
- [ ] New hire: no seed `goal.md`; one parked “What should I own?” (not a work pitch, not a hidden intro)
- [ ] Skip on that card does not nag the next morning
- [ ] With a goal: one Yes/No idea at a time; Skip stays quiet
- [ ] Parked ask card in the 1:1 office; answer continues; Skip / No drops
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
- If `goal.md` is written only via `shell` (`echo > goal.md`) and not `write`, still detect it on the next desk-check by `read`.
- Group rooms: no desk-check. A seated guest must not pitch in the group from this clock.
- When in doubt, prefer quiet. Asking once for a goal is required. Inventing work without a goal is not. A missed idea is better than a blast.
