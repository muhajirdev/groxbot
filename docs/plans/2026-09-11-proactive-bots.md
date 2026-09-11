# Proactive bots (office `ask`, inferred aims, Today pulse)

**Date:** 2026-09-11
**Status:** implementation-ready
**Do not start from:** Muse Goals-as-home, Cursor Project `notes.md`, a dispatcher cockpit, Paperclip, a `tasks` table, or a **Suggestions inbox / suggestion theater**

This plan is for another agent to implement. Read it whole before editing. Match [AGENTS.md](../../AGENTS.md), [docs/rooms-plan.md](../rooms-plan.md), and [docs/computers.md](../computers.md). Do not implement from this PR.

---

## Goal

Teammates get a **“Suggested for you” card in that person’s office**: one parked `ask` (pitch + Yes / No, or a light goal question). Standing aims are **inferred** — `goal.md` if it exists, plus `activity.md`, notes and files on this computer, room papers, soul/memory, and recent proof in the thread. The company glance is a derived **Today** pulse (`Stripe Buddy · has an idea`), not a shared org file and not a Suggestions contact.

Stop when:

- A desk-check can pitch **one** idea from whatever signal is on the desk, even if `goal.md` is missing.
- It may **sometimes** ask about goals when aims are unclear. It must **not** require the human to write `goal.md` first, and the host must **not** treat a missing file as an empty-desk gate.
- Quiet when there is **truly no signal** (new hire, empty computer, empty thread, nothing in rooms) — not because a filename is absent.
- Yes never silently send / spend / hire / publish.
- There is no Goals chrome tab, no suggestion theater, no `tasks` table, no `notes.md` product file, no org `activity.md`.

---

## Why (the mix)

Walk-in should feel like a **team**: people, rooms, proof of work. Today the office is reactive. New hires open on an empty desk (`OfficeWelcome` in `apps/web/src/components/OfficeThread.tsx`) and stay silent until a human sends. Routines already fire (`runScheduledRoutine` → `appendOfficeUserAndRun`). Idle Learned already files after tool work (`runOfficeReviewTurn`). `ask` already parks a live turn (`OfficeAskBoard` + `AskToolUI`). Hire approval (PR 105) already parks a Code Mode execute until Hire / Don't hire (`OfficeApprovalBoard` + `OfficeApprovalCard`).

What is missing is the **proactive** shape: a teammate who notices proof and asks “want me to do it?” — intelligent and dynamic, not a checklist that blocks on `goal.md`.

| Piece | Today | Target |
|---|---|---|
| Clock | Human send, routine kick (visible user row, **forbids ask**), idle Learned (hidden kick, Skip stays off the log) | Desk-check **schedule** on the home `RoomActor`; idle Learned stays filing-only |
| Pitch | Model may `ask` only while Cap’n Web is live; unattended → skip | Parked Yes/No (or light goal-ask) survives the human being away (copy hire park) |
| Fuel | Soul / memory via `set_context`; no standing-aims convention | **Inferred aims**: `goal.md` if present, else `activity.md`, computer notes/files, room papers, recent thread proof. `goal.md` is optional. |
| Proof | Thread + optional Learned line | Prefer computer `activity.md`; also whatever already happened in the office / files / rooms |
| Company glance | Roster `lastPreview` from the last chat line | Derived pulse: `Name · has an idea` when an ask is parked. **Not** a Suggestions inbox. |

Do not solve this by becoming Muse (Goals tab as home), a Cursor coordinator (`notes.md` + subagent swarm), Paperclip (org task graph), or a Grok-style Suggestions theater (fake contact + 7 stacked ideas).

---

## Locked product

1. **Team-first.** Home is people, rooms, and proof. Not personal Goals. Not a dispatcher. **No suggestion theater** — no Suggestions row above the roster, no “7 ideas waiting” carousel. Click the **person**; the card is in **their** thread.
2. **1:1 only.** The bot posts the card in **its home office** (`bots.homeRoomId`). Not a group room, not poke, not a workspace feed.
3. **One card at a time per bot.** No blast. If an ask is already parked, later desk-checks no-op.
4. **Ask card in that thread.** Same widget as today’s `ask`. Usual idea: pitch + **Yes, do it** / **No** (“Want me to do it?”). Sometimes a **light goal-ask** when aims are unclear (Yes/No or a short prompt). Park like hire approval. Answering continues Pi; Skip / No drops it. Yes does not type a new composer message — it unblocks that parked turn.
5. **`goal.md` is optional fuel, not a gate.** The host must not skip Pi because the file is missing. The model must not refuse to pitch solely because the file is missing. If they (or the human) write `goal.md`, treat it as a strong hint. Host never seeds it.
6. **Infer aims.** Desk-check should look at `activity.md`, other computer files/notes, room papers, soul/memory, and recent office proof. Pitch from that. Do **not** require a product file `notes.md` — but if notes exist, read them.
7. **Quiet = no signal.** Empty computer, empty thread, no room papers, no recent proof → Skip (silent). Missing `goal.md` is **not** “no signal.”
8. **Never auto-run send / spend / hire / publish.** Cute avatars ≠ silent side effects. Existing Code Mode `requiresApproval` stays. Yes on an idea means “work this,” not “wire money.”
9. **Clocks we already have.** Home `RoomActor` `this.schedule` / `listSchedules` / `cancelSchedule` (`cf_agents_schedules`) and idle Learned snapshot turns. Reuse those. No `tasks` table. No Goals chrome tab.

---

## Non-goals (do not do these)

- Do **not** add a product file `notes.md` (Cursor Project convention). Knowledge or computer notes may exist; they are fuel to read, not a required schema.
- Do **not** add a workspace / org `activity.md` on R2 or D1.
- Do **not** add a `tasks` table, D1 jobs catalog, or Tonbo / baerly.
- Do **not** add a subagent swarm, `AgentSpawner` people, or Paperclip orchestration.
- Do **not** add `BotActor`, a `computers` table, a Computer Durable Object, or a second filesystem inside Code Mode.
- Do **not** put standing aims in Knowledge (R2) as the store. The library is playbooks. Prefer this computer + the office log + room papers.
- Do **not** start a proactive turn from idle Learned. Learned stays: hidden kick, file playbook/soul/memory, one Learned line or Skip.
- Do **not** add an inbound-mail / plugin event bus as the v1 wake. Mail can be fuel the model reads **during** a desk-check if a plugin is already connected. It does not start the turn.
- Do **not** run a hidden office-intro. Do not seed `goal.md`.
- Do **not** gate the desk-check on `goal.md` existing or missing.
- Do **not** add a Suggestions inbox / fake contact / idea carousel.
- Do **not** call live OpenRouter / grox-gateway / Computer / TinyFish in tests. `ScriptedAgentRuntime` only.

---

## Target architecture

```
home RoomActor (name = homeRoomId)
──────────────────────────────────
Computer Workspace          Pi Session (DO SQLite)
  goal.md (optional)           office log + parked ask
  activity.md (proof)
  other files / notes         Cap’n Web /rooms/:roomId/rpc
Room papers (if seated)

this.schedule ──desk-check──▶ hidden kick (off the log)
                               read whatever signal exists
                               if one concrete idea: ask (Yes / No)
                               if aims unclear: sometimes light goal-ask
                               if no signal: Skip (quiet)

idle Learned snapshot ──▶ may append activity.md; never pitches

roster pulse (Phase C) ── derived from parked ask + lastPreview
                               not a shared file, not a Suggestions row
```

D1 stays the shared-team catalog (auth, roster, rooms). Office transcript stays Pi on the home actor. Knowledge stays R2. Computer files stay DO SQLite VFS (`@cloudflare/computer` `Workspace`, cwd `/workspace`).

### What actually starts a proactive turn

| Clock | Starts a pitch? | Why |
|---|---|---|
| **Desk-check schedule** (`this.schedule` on home) | **Yes — the only v1 wake** | Same Agents clock as routines, different callback. Hidden kick. Allowed to `ask`. |
| **Idle Learned** (`runOfficeReviewTurn`) | **No** | After ~15 settled tool parts. Kick off the log. Skip stays quiet. May append `activity.md` if the stretch produced proof. |
| **Human send** | No (reactive) | Composer still works. May file or update `goal.md` / `activity.md` from that job. Not the proactive pitch. |
| **Existing human routine** (`runScheduledRoutine`) | **No** | Visible user kick; system prompt currently **forbids ask** (`OFFICE_ROUTINE_KICK_INSTRUCTIONS`). Leave that path alone. |
| **Mail / plugin event** | **No (v1)** | No inbound wake today. Do not add one. A later trigger may enqueue the **same** desk-check; not a new product clock. |

Host safety on every desk-check fire (before Pi):

1. A parked `ask` already waiting → return. One card at a time.
2. Office turn already running → do not enqueue a second loop.
3. Last **goal-ask** was skipped recently and nothing new has appeared (no new human row, no new files) → return (no daily nag on the same question). A later human message, new proof, or a long backoff (implementer: ≥ 7 days) may try again.
4. **Do not** return solely because `goal.md` is missing. Missing file is not a host gate.
5. Optional cheap host skip: if the computer is empty **and** the office session has no human user row **and** there are no room papers to read — treat as no signal and Skip without a model call. That is “truly empty,” not “no goal.md.”

Default cadence: **once per day** after the first tick (workspace timezone if you have it, else UTC). **First tick does not wait a day** — `ensureDeskCheckSchedule` on hire (and on first office open if the schedule is missing). A brand-new empty hire may Skip (quiet). The human can pause the desk-check via existing routines pause.

Do **not** auto-create `goal.md`. Do **ensure** one desk-check schedule on hire. The model may change cadence with `routines.update` later; it must not be the only way the clock appears.

### Why not `runScheduledRoutine` as-is

`formatRoutinePrompt` + `withOfficeRoutineKick` tell the model this is a scheduled job, to execute with tools, and **not** to ask clarifying questions. A “Want me to do it?” card **is** an ask. Reusing that callback would fight the routine product.

Add a reserved callback (name bikeshed: `runDeskCheck`) on the same `RoomActor`, same `cf_agents_schedules` table. Kick text stays off the office log (copy `runOfficeReviewTurn` / `officeReviewUserText`). If there is signal and one idea, the artifact is a Yes/No `ask`. If aims are unclear, a light goal-ask is allowed. If there is no signal, reply `Skip` and stay quiet. Never a cron bubble. Never a Suggestions inbox.

---

## UX

### 1:1 ask card (in that person’s office)

Not a second home. Open Stripe Buddy → card in **their** thread, like hire approval. Copy: teammate, not “agent run.”

**Usual: pitch an idea**

- Short pitch from inferred aims (why it serves what they already own / just did).
- “Want me to do it?” **No** / **Yes, do it**.
- Yes → unblocks the same Pi `execute` (or a continuation of that ask). The model continues (research, draft, write `activity.md`). Send / spend / hire / publish still need their own approvals.
- No → skip; optional one-line `activity.md` append (“skipped: …”). No follow-up nag this tick.

**Sometimes: light goal-ask**

- When aims are unclear (no `goal.md`, thin activity, vague soul) **and** there is *some* reason to talk (they hired a Talent Scout, they pasted a brief, marketplace soul exists) — one light ask: “Is outbound still what I own?” or “What should I own?” with short chips.
- Not mandatory on every empty hire. A completely blank desk with no role signal → Skip, not a nag.
- If they answer, the bot **may** write `goal.md`. That is a convenience, not a requirement for future pitches.

Both: parked in the transcript; survives the human being away. Current `ask` returning `officeAskSkipped("unattended")` when `!this.live` is **wrong** for this loop — that is Phase B.

### Roster / Today snippet

Needs-attention already belongs on the list ([docs/grok-bot-ui.md](../grok-bot-ui.md): question, approval, handoff). Phase C makes the glance:

`Stripe Buddy · has an idea`

If the parked card is a goal-ask, `needs a goal` is fine. Same derived glance. **Do not** add a Suggestions row above the bot cards.

Derived. Instant paint from last-known Query / IndexedDB (`docs/caching.md`). Do not fan-out `read()` of every computer on `bots.list`.

Until Phase C, a parked ask still shows in the open thread; roster may keep using `lastPreview` from chat. Do not block A/B on Today.

If the roster gets noisy later: **sort people with a parked ask to the top**. Still people. Still one click into their office. That is not a suggestion theater.

### Empty desk vs signal

| State | UI | Proactive |
|---|---|---|
| New hire, empty computer, no human rows, no room papers | Empty desk copy | Desk-check may fire; **Skip** (quiet). Not a forced goal-ask. |
| Signal without `goal.md` (thread, `activity.md`, files, room papers, marketplace soul) | Office as today | May pitch one Yes/No idea **or** a light goal-ask |
| `goal.md` exists | Office as today | Same: one idea from aims + proof, or Skip |
| Goal-ask skipped, nothing new | Empty or prior thread | No daily nag until new signal or ≥ 7 days |
| Parked ask | Card in that thread | Further ticks no-op |

Do not run a hidden office-intro. `subscribeOffice` already skips that (`OFFICE_INTRO_STORAGE`). Keep it.

Composer placeholder can stay “Job description or first task.”

---

## Data files

Computer cwd is `/workspace` ([docs/computers.md](../computers.md), `COMPUTER_VFS_ROOT`).

| File | Role | Who writes |
|---|---|---|
| `/workspace/goal.md` | **Optional** standing aims. Strong hint when present. | Human or the bot via `write` / `edit` after they state aims. **Host does not seed. Missing is not a gate.** |
| `/workspace/activity.md` | Proof log when they keep one. Newest first or dated appends. | Bot after real work (human task, Yes-on-idea, or Learned that filed). Human may edit. **Not required** to pitch if proof lives in the thread or other files. |

Also read (do not require): other computer markdown, room papers (`room_read` when relevant), soul/memory (`set_context` blobs). Resolve paths like other computer files (`computerVfsPaths`). Do not put aims under `inbox/` as a schema.

**Not Knowledge as the store.** `knowledge.write` is the office library. Do not dual-write a required goals catalog there. If a playbook already exists, the desk-check may `knowledge.search` / `read` as extra signal.

### How the model is prompted

When computer FS tools are on the turn, `buildOfficeSystemPrompt` (`packages/core/src/office-system-prompt.ts`) gains a guideline, roughly:

- Standing aims may live in `goal.md` on this computer. Proof often lives in `activity.md`. Neither file is required. Infer from files, notes, rooms, and recent proof.
- After real work, append `activity.md` when you have an outcome. Update `goal.md` when aims actually changed — do not invent the file to unblock yourself.
- One card at a time. To pitch, call top-level `ask` with Yes / No. If aims are unclear, you may ask a light goal question. Do not send / spend / hire / publish without approval even if they said Yes to the idea.
- If there is truly nothing to go on, do not pitch and do not nag for a goal.

Desk-check system overlay (like `<scheduled_job>`, but a distinct tag, e.g. `<desk_check>`):

- This is not a human message. Never mention the kick.
- Look at `goal.md` if it exists, then `activity.md`, recent computer files, and the thread. Room papers only if they matter.
- If you have **one** concrete idea that is not already in flight, `ask` with Yes / No. Stay in the office. Do not email/send/spend/hire/publish on this tick unless they already approved that tool this turn.
- If aims are unclear **and** there is some role or proof to hang a question on, a light goal-ask is OK.
- If there is no signal, reply exactly `Skip`. Missing `goal.md` alone is not a reason to Skip and not a reason to force a goal-ask.

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

Reject a structured D1/JSON goals API. Reject “must create `goal.md` before any idea.”

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
  gates: parked ask? turn busy? goal-ask recently skipped with no new signal?
         truly empty (no files, no human rows, no room papers)? → Skip, no model
  else → hidden user kick + runPiTurn (ScriptedAgentRuntime in tests)
        ├─ concrete idea from inferred aims → ask(Yes/No) → park
        ├─ aims unclear but some signal → light goal-ask (park)
        └─ no signal / nothing worth asking → Skip (quiet)
```

Reuse `enqueueTurn`. Reuse `officeReviewAnnounce` / Skip hiding in projection (`isOfficeReviewSkip` / `isVisibleChatMessage`). Desk-check Skip must stay off the thread the same way.

Parked ask: extend `OfficeAskBoard` so a desk-check (or all office asks) **do not** `officeAskSkipped("unattended")` when nobody is subscribed. Persist waiter in DO storage if the isolate may sleep — hire park is in-memory on the live `code` execute; desk-check must survive a restart. Prefer: serialize the pending `OfficeAskPrompt` in `this.ctx.storage`, rehydrate on alarm/subscribe, and keep the Pi tool execute blocked (or resume via a continuation) until Yes / No.

If persisting a live Pi `execute` across DO hibernation is too sharp for v1, the allowed fallback is: finish the desk-check tool with a durable “parked idea” record, render the same `ask` card from storage, and on Yes enqueue a **continuation** turn (“They said yes to: …”) that is not a new idea. That is still one idea, still Yes continues / No drops. Do not invent a second tool name; the UI stays `ask`.

`enterLive` / `leaveLive` stay for *in-conversation* clarifying asks if you keep unattended-skip there. Proactive park is a different waiter class or a flag on the prompt (`source: "desk-check"`). Pick one implementation; do not ship two Yes/No widgets.

---

## Safety

- **Ask-before-act.** Desk-check must not call send/spend/hire/publish tools before Yes. After Yes, those tools still use existing approval cards.
- **Rate.** One parked ask per home room. Daily tick after the first. Skip if busy or parked. Goal-ask Skip does not come back the next morning without new signal.
- **No seed.** Host never writes `goal.md`.
- **No `goal.md` gate.** Host and prompt must not treat a missing file as “do not run” or “must only ask for a goal.”
- **Pause.** Existing routines pause must be able to stop the desk-check. No zombie ticks.
- **Unattended.** Do not treat “no socket” as No. Park.
- **Group / poke.** Desk-check never posts to a group log or a poke thread.
- **No theater.** No aggregated suggestion inbox.

---

## Current files the implementer will touch

### Convention + prompt (Phase A)

- `packages/core/src/office-system-prompt.ts` — infer-aims guideline; `goal.md` / `activity.md` as optional; desk-check overlay helper
- `packages/core/src/office-system-prompt.test.ts`
- `packages/core/src/office-review.ts` — optional `activity.md` line when Learned files; still no pitch
- `apps/api/src/bot-actor.ts` — `ensureDeskCheckSchedule` on hire; `runDeskCheck`; **no** missing-`goal.md` gate; truly-empty Skip; skip-nag only for recent goal-ask with no new signal
- `apps/web/src/components/OfficeThread.tsx` — empty-desk copy stays; no forced goal chrome

### Parked ask (Phase B)

- `packages/core/src/office-ask.ts` — durable park, Yes/No helpers, skip reasons
- `apps/api/src/bot-ask.ts` — `OfficeAskBoard` (today skips unattended)
- `apps/api/src/bot-approval.ts` — pattern to copy (`OfficeApprovalBoard.wait` / `resume`)
- `apps/api/src/bot-office-rpc.ts` — already has ask answer/skip + `approveApproval`
- `apps/web/src/components/AskToolUI.tsx` — card already exists; Yes/No copy (“Want me to do it?”)
- `apps/web/src/components/OfficeApprovalCard.tsx` — visual sibling, not a second widget
- `packages/core/src/routines.ts` — **do not** weaken `OFFICE_ROUTINE_KICK_INSTRUCTIONS` for ordinary routines

### Today pulse (Phase C)

- `apps/web/src/lib/bot-preview.ts`, `apps/web/src/lib/chat-messages.ts` / `packages/core/src/pi-projection.ts` — `lastProjectedPreview`
- Roster row in `apps/web/src/screens/Chat.tsx` — person row, not a Suggestions contact
- Optional: when ask parks, patch `lastPreview` to `has an idea` (D1 `bots.lastPreview` already exists). No new column required if the actor already updates preview.

### Stay

- Computer VFS / `write` / `read` / `edit`
- `ScriptedAgentRuntime` / `runPiTurn`
- D1 roster (PR 106). Do not put goal text in D1.
- Knowledge R2, Skills store, marketplace catalog

---

## Invariants (lock these)

1. **Instance name is `roomId`.** Desk-check runs on the home `RoomActor`. Never a `BotActor`.
2. **`goal.md` is optional.** Not a host gate. Not the only fuel. Computer + thread + rooms are in play.
3. **One parked card per home room.** Host-enforced. Goal-ask and idea-ask share that slot.
4. **Answer continues, Skip / No drops.** Same turn or an explicit continuation of that ask — not a fresh brainstorm. Not a new user bubble from the composer.
5. **Skip is silent** when there is no signal or nothing to pitch.
6. **Quiet = no signal**, not “file missing.”
7. **Approvals still exist** for hire/send/spend/delete/publish after Yes.
8. **No suggestion theater.**
9. **Tests offline.** No live model, Computer, or TinyFish.

---

## Phases

Ship in order. A/B before C. Each phase leaves `pnpm test` / targeted vitest green.

### Phase A — Convention + prompt

Teach inferred aims. Wire `ensureDeskCheckSchedule` on hire + `runDeskCheck`. Host gates: parked / busy / truly empty / recent skipped goal-ask with no new signal. **No** `goal.md` existence check. Scripted empty desk → Skip, no forced goal-ask. Scripted desk with `activity.md` (or a human row) and no `goal.md` may pitch or light-ask.

Acceptance: hire schedules a desk-check. Missing `goal.md` does not by itself skip the turn **or** force a goal-ask. Truly empty → no user-visible row (Skip). System prompt says aims are inferred; `goal.md` optional. No seed `goal.md`.

### Phase B — Parked ask card

Durable park. Copy hire park UX. Idea Yes/No; optional light goal-ask. Unattended parks. Card in **that** thread (`AskToolUI`). Do not auto-send. No Suggestions inbox.

Acceptance: scripted desk-check with proof in `activity.md` and no `goal.md` can park a Yes/No idea. Scripted unclear-aims + role signal can park a light goal-ask. No subscriber; waiter still pending; Yes resumes; a second desk-check while parked is a no-op. No live APIs.

### Phase C — Today pulse

Roster snippet derived from parked ask (`Name · has an idea`). Instant paint. Not a shared org file. Not a Suggestions row. Ship after A/B.

---

## Tests (offline only)

| Case | Assert |
|---|---|
| System prompt with computer FS tools | mentions `goal.md` / `activity.md` as optional; infer from files/proof; does not require `notes.md` |
| Hire | one desk-check schedule exists; no seed `goal.md` |
| Missing `goal.md` is not a host skip | `runDeskCheck` still allowed when `activity.md` or a human row exists |
| Truly empty | no model, or Skip with nothing on the log |
| Idea from `activity.md` without `goal.md` | may `ask` Yes/No; must not send/spend/hire |
| Light goal-ask | allowed when aims unclear **and** some signal; not required on blank hire |
| Goal-ask Skip | no daily re-fire until new signal or ≥ 7 days |
| Desk-check Skip (nothing to do) | no office log row |
| Parked ask, unattended | not `skipped: unattended`; pending survives |
| Yes on an idea | continues the same idea; still cannot publish without approval |
| No on an idea | waiter gone; no send |
| Second tick while parked | no second Pi turn |
| Ordinary routine kick | still forbids clarifying `ask`; unchanged |
| Idle Learned | can mention `activity.md`; does not call `ask` in the review user text |
| `ScriptedAgentRuntime` | scripted tool results only |

Web: extend `apps/web/src/lib/ask-ui.test.ts` for Yes/No copy. Phase C: `bot-preview` / sidebar tests for `has an idea` without waiting on a computer read. No Suggestions-row tests — that UI must not exist.

Do not start `computerUse` / headed browser unless asked.

---

## Suggested PR slices

1. **Prompt + host gates + `runDeskCheck`** (Phase A) — hire schedules the clock; infer-aims prompt; truly-empty Skip; **no** `goal.md` gate
2. **Durable parked `ask`** (Phase B) — Yes/No idea + optional light goal-ask, unattended park, in the person’s thread
3. **Today pulse** (Phase C) — `has an idea` on the **person** row

Do not land C on a world where unattended asks still skip.

---

## Acceptance checklist

- [ ] Desk-check is `this.schedule` on the home `RoomActor`, not a `tasks` table, not Worker Cron, not idle Learned
- [ ] `goal.md` is optional; missing it does not skip the clock and does not force a goal-ask
- [ ] Aims inferred from `activity.md` / files / rooms / proof, not only `goal.md`
- [ ] Truly empty hire stays quiet (Skip), no hidden intro, no seed `goal.md`
- [ ] One Yes/No (or light goal-ask) at a time in **that** office thread
- [ ] No Suggestions inbox / fake contact / idea carousel
- [ ] Unattended does not mean No
- [ ] Send / spend / hire / publish still need approval after Yes
- [ ] Today pulse (when shipped) is derived on the person row; no org `activity.md`
- [ ] `rg` does not grow `BotActor`, `computers` table, or Code Mode dual FS
- [ ] `pnpm test` / targeted vitest; `ScriptedAgentRuntime` only

---

## Implementer notes

- Hire approval (PR 105) is the parked-turn **UX** to copy, not the tool. The tool is still top-level `ask` (PR 99). Do not route a proactive idea through `bots.hire` or generic `Approve ${connector}.${method}`.
- Catalog is D1 (PR 106). That does not make D1 the activity store. `bots.lastPreview` is a fine pulse cache; goal text is not a D1 column.
- `OfficeAskBoard.enterLive` is tied to `subscribeOffice`. Proactive exists so the bot can speak **before** they open the thread. Design the waiter for that.
- Yes = continue the parked turn, not `appendOfficeUserAndRun` a fake “please do it” user line unless you are on the hibernation-fallback continuation (and that continuation is still the same idea).
- Group rooms: no desk-check. A seated guest must not pitch in the group from this clock. Reading room papers as **signal** on a later home desk-check is OK; posting the card in the group is not.
- When in doubt, prefer quiet. A missed idea is better than a blast. A missing `goal.md` is not quiet by itself.
