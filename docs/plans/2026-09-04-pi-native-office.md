# Pi-native office (leave Vercel AI SDK)

**Date:** 2026-09-04
**Status:** implementation-ready
**Reference:** [assistant-ui `packages/react-pi`](https://github.com/assistant-ui/assistant-ui/tree/main/packages/react-pi) (`@assistant-ui/react-pi`)
**Do not start from:** `@assistant-ui/react-pi/node` / `createPiNodeClient`

This plan is for another agent to implement. Read it whole before editing. Match [AGENTS.md](../../AGENTS.md) and [docs/rooms-plan.md](../rooms-plan.md).

---

## Goal

Office and group chat become **Pi all the way down**: Pi messages in storage, Pi events on the wire, Pi `AgentTool`s in the loop, assistant-ui rendering a **projection** of Pi (not `UIMessage`).

Stop when:

- No office/group chat path imports `ai` / `@ai-sdk/react` / `@assistant-ui/ai-sdk`.
- The Durable Object transcript is Pi `Session` (home) or Pi-shaped rows (group) — not JSON `UIMessage`.
- Cap’n Web carries Pi snapshots + events, JSON-only.
- `useAISDKRuntime` is gone. The thread UI is assistant-ui over Pi-projected `ThreadMessageLike`.
- Computer `exec` drains to a JSON result before it touches Session or Cap’n Web (the AsyncGenerator crash cannot recur).

---

## Why (the mix)

Today three stacks are glued together:

| Layer | What we use | What Pi actually is |
|---|---|---|
| Loop | `runAgentLoopContinue` | Pi |
| Tools | `tool()` / `ToolSet` / `createAITools` → `aiToolsToPi` | `AgentTool` |
| Durable log | Pi `Session` (new) **plus** `office_chat` UIMessage JSON (legacy) | `SessionTreeEntry` |
| Wire | Cap’n Web `message` / `stream` of `OfficeChatMessage` | `PiClientEvent` |
| UI | `useAISDKRuntime` + `UIMessage` from `"ai"` | `ThreadMessageLike` via `projectPiThreadMessages` |

That mix caused the hung `exec` / Cap’n Web `AsyncGenerator` crash: AI SDK `execute` may return a generator; Pi `await`s a finished result; the generator leaked into Session `details` and subscribe. `/workspace` missing is a **separate** VFS bug (`ensureComputerHome`) — fix it in this work if the computer tools still assume that cwd, but do not treat it as the message-model problem.

assistant-ui’s react-pi does **not** use `UIMessage`. Canonical type is `PiAgentMessage[]`. They project once, at the UI, into `ThreadMessageLike[]`. Copy that split. Do not copy their Node host.

---

## Non-goals (do not do these)

- Do **not** add `BotActor`, `SessionManager`, a custom `SessionProvider`, or Cloudflare Session as the office catalog.
- Do **not** put Pi on the group `RoomActor`. Group wakes the target’s **home** `RoomActor`. Instance name stays `roomId`.
- Do **not** use `@assistant-ui/react-pi/node`, `createPiNodeClient`, or a process-singleton `PiThreadSupervisor`. That is Node, HMR-sticky, and will not survive Workers / Durable Objects.
- Do **not** add HTTP/SSE `/api/pi/**`. Cap’n Web `/rooms/:roomId/rpc` stays the transport.
- Do **not** mount react-pi’s multi-thread `ThreadList` as the product catalog. Roster/rooms stay Postgres + oRPC. One live Pi session per home room.
- Do **not** add a `computers` table, Computer Durable Object, or `@cloudflare/shell`.
- Do **not** make Postgres the office transcript.
- Do **not** hand-write Drizzle SQL. This work should not need a Postgres schema change.
- Do **not** call live OpenRouter / Computer / Sandbox in tests. `ScriptedAgentRuntime` / `scriptedPiStreamFn` only.
- Do **not** keep `OfficeChatMessage` as a “temporary UI type” after the client switch. Kill it once the wire is Pi.

---

## Target architecture

```
browser                                      home RoomActor (DO)
───────                                      ───────────────────
assistant-ui Thread
  └ usePiRuntime  OR  ExternalStore          Pi Session (DO SQLite)
       + projectPiThreadMessages               pi_session_entries
  └ Cap’n Web PiClient  ──────────────────▶  runAgentLoopContinue
       snapshot + PiClientEvent                AgentTool[] (not ToolSet)
                                               Computer Workspace + Worker shell
```

Group room: same **wire shape** (Pi messages / folded projection), **no** loop, **no** Session. It stores a Pi-shaped log and forwards the wake to `homeRoomId`.

### What to take from react-pi

Read these files on `assistant-ui/assistant-ui` `main` (package `@assistant-ui/react-pi`):

| File | Take |
|---|---|
| `src/types.ts` | JSON-safe Pi message / event / snapshot contract. Browser-safe; no `@earendil-works/pi-*` import. |
| `src/runtime/messageProjection.ts` | Fold assistant + `toolResult` into one `ThreadMessageLike`. Pair tools by `toolCallId`. |
| `src/runtime/threadState.ts` | Event reducer over `PiClientEvent`. |
| README “Package boundary” | Browser half never imports Pi packages. Node half is **not for us**. |

Prefer depending on `@assistant-ui/react-pi` (browser entry only) for `projectPiThreadMessages`, `reducePiThreadState`, `usePiRuntime`, and the `PiClient` type — **if** versions match `@assistant-ui/react` ^0.15 (web already has `^0.15.17`).

If `usePiRuntime` fights the office (it wants a thread catalog, model picker, host-ui side channel): still use the package for **types + projection + reducer**. Drive assistant-ui with `useExternalStoreRuntime` / equivalent, feeding `projectPiThreadMessages(...)`. Do not reimplement projection from scratch.

### What we implement (Cloudflare)

A Cap’n Web object that satisfies the **spirit** of `PiClient` for **one thread** (`threadId === roomId`):

- `getThread()` → snapshot `{ metadata, messages: PiAgentMessage[], lastError? }`
- `sendMessage(input)` → append user + run loop
- `cancelRun()` → abort
- `subscribe(listener)` → push `PiClientEvent` (snapshot-first, then live events)
- Optional later: `clearQueue`, host-ui. Not v1 unless already needed.

Do **not** implement `listThreads` / `createThread` / `archiveThread` / `setModel` as product APIs. Model keys stay workspace BYOK / hosted gateway as today.

---

## Current files the implementer will touch

### Server / adapters (the mix)

- `apps/api/src/bot-actor.ts` — `getTools(): ToolSet`, `aiToolsToPi`, `officeUiLog`, `runOffice` takes `OfficeChatMessage[]`, group wake uses `officeLogToPiMessages`
- `apps/api/src/bot-office-tools.ts` — `aiToolsToPi` (`ToolSet` → `AgentTool`), plus `resolveAiSdkToolResult` stopgap
- `apps/api/src/bot-office-rpc.ts` — Cap’n Web `message(row)` / `stream({ message })` / `run(messages)`
- `apps/api/src/bot-present.ts`, `bot-markdown.ts`, `bot-execute.ts` — `tool()` / `ToolSet` / `toolSetConnector`
- `apps/api/src/room-actor.ts` — `room_chat` payloads are `OfficeChatMessage`
- `packages/adapters/src/office-pi.ts` — `applyOfficeAgentEvent` → UIMessage draft; `officeLogToPiMessages` reverse map
- `packages/adapters/src/office-session.ts` — Session ↔ UIMessage fold
- `packages/adapters/src/durable-session-storage.ts` — keep; this is the right store
- `packages/core/src/office-chat.ts` — local `UIMessage` clone; comment still says “Durable rows are JSON UIMessages”

### Client (assistant-ui via AI SDK)

- `apps/web/src/components/OfficeThread.tsx`, `RoomThread.tsx` — `useAISDKRuntime` + `UIMessage`
- `apps/web/src/lib/use-office-chat.ts`, `use-room-chat.ts` — Cap’n Web subscriber typed as `UIMessage`
- `apps/web/src/lib/chat-messages.ts`, `office-messages.ts`, `room-messages.ts`, `outgoing-user-message.ts`
- `apps/mobile/src/lib/use-office-chat.ts`, `chat-messages.ts`, `OfficeThread.tsx`
- `packages/contracts/src/office-user.ts` — sender lives on `UIMessage.metadata`

### Stay (already Pi or unrelated)

- `packages/adapters/src/pi-turn.ts` — `runPiTurn` / `scriptedPiStreamFn` / gateway `StreamFn`
- `packages/adapter-kit/src/pi-turn.ts` — owned poke/guest text lines (`OwnedPiLine`). Poke is **not** the office transcript; leaving it text-only is OK
- Hosted model gateway (`packages/adapters/src/gateway.ts`) — HTTP completions, not UIMessage
- Knowledge / routines connectors — already Code Mode inside `execute`, not chat `ToolSet` on the client

---

## Invariants (lock these)

1. **Pi Session is canonical on the home instance.** `session.buildContext().messages` is what the loop sees. Never convert a UI projection back into model context (`officeLogToPiMessages` dies except one-shot migrate).
2. **Every value that hits SQLite or Cap’n Web is JSON.** `JSON.parse(JSON.stringify(x))` (or existing `jsonClone`) before `appendMessage` / broadcast. No generators, no functions, no class instances in `details`.
3. **Tool `execute` returns a finished Pi result** `{ content: [{ type: "text", text }], details?: json }`. If a vendor API yields an `AsyncIterable`, drain it **inside** the AgentTool, then clone.
4. **One assistant bubble in the UI is a projection**, not storage. Storage keeps Pi’s assistant + `toolResult` messages separately (react-pi `messageProjection.ts`).
5. **Sender metadata** (who typed) is a Pi `custom` session entry (already `OFFICE_META_CUSTOM_TYPE`) or `metadata.custom` on the projected `ThreadMessageLike` — not `UIMessage.metadata.user`.
6. **Group log is Pi-shaped JSON**, but the group actor does not call `runAgentLoopContinue`. Home actor reads that slice as `Message[]` directly.
7. **Code Mode** may still use `@cloudflare/codemode` internally. The **model** only sees one Pi `AgentTool` named `execute`. Do not wrap the whole computer in `ToolSet` just to feed Code Mode.

---

## Phases

Ship in order. Each phase should leave `pnpm test` / targeted vitest green and the office able to send a text turn.

### Phase 0 — Contract in `packages/*`

Add a browser-safe Pi wire module (name bikeshed: `packages/adapters/src/pi-wire.ts` or `packages/core/src/pi-transcript.ts`).

- Re-export or locally mirror react-pi `PiAgentMessage`, `PiClientEvent`, `PiThreadSnapshot`.
- Prefer `import type` from `@assistant-ui/react-pi` if that package is a web dependency; **server must not import the React runtime**. If the types-only import pulls React, copy `types.ts` into `packages/core` (it is a plain type mirror of Pi 0.78–0.80).
- JSON parse helpers: `parsePiAgentMessage`, `parsePiClientEvent`, `jsonClone`.
- Tests: round-trip a user / assistant / toolResult; reject a generator-like object from `jsonClone`.

Update [docs/rooms-plan.md](../rooms-plan.md): home transcript is Pi Session (`pi_session_entries`), not “DO SQLite `office_chat` UIMessages”. Cap’n Web is Pi events, not assistant-ui AI SDK messages.

### Phase 1 — Harden the loop boundary (unblocks exec)

Do this **before** the UI rewrite. It is the production crash.

1. Replace `getTools(): ToolSet` with `getAgentTools(): AgentTool[]` on the home actor.
2. Author tools as Pi `AgentTool` (helper OK: zod → `z.toJSONSchema` → `parameters`). Files:
   - `bot-present.ts` — `present`
   - `bot-markdown.ts` — `fetch_url`, `to_markdown`
   - `bot-actor.ts` — `set_context`, group `room_*`
3. Computer: do **not** pass `createAITools()` through a naive `await execute()`. Either:
   - **Preferred:** wrap `workspace.fs` / Worker shell `exec` in our own `AgentTool`s (list, read, write, exec, find/grep as today). Drain `exec` stdout/stderr until exit; `details` is `{ stdout, stderr, exitCode }` JSON.
   - **Acceptable island:** if `@cloudflare/computer/tools` `createAITools` must stay, the wrapper **must** `for await` any iterable, then `jsonClone`, **never** store the generator. Delete `aiToolsToPi` once nothing passes `ToolSet` in.
4. `createOfficeExecuteTool`: keep `createCodemodeRuntime` / `toolSetConnector` **inside** the execute implementation. Build the tiny `ToolSet` of **page tools only** if Code Mode still requires `ToolSet`. The Pi loop receives a single `AgentTool` `execute`. Computer file/bash tools are **siblings** on the Pi tool list, not Code Mode connectors (AGENTS.md).
5. `persistOfficeSessionEvent`: clone `message` before append. Add a test that an `AsyncGenerator` details object cannot be stored.
6. Call `ensureComputerHome(this.workspace.fs)` (or equivalent) on computer init so `/workspace` exists. Test in `bot-computer-workspace.test.ts`.

Acceptance: scripted turn with a fake exec tool that returns an async generator → Session row is JSON, Cap’n Web fixture does not throw. `list /workspace` succeeds on a fresh VFS.

### Phase 2 — Home RoomActor speaks Pi on Cap’n Web

Change `OfficeChatHost` (`bot-office-rpc.ts`):

**Remove**

- `run(messages: UIMessage[])`
- `subscribe` pushing `message(row: UIMessage)` / `stream({ message: UIMessage })`

**Add** (names can match react-pi so a future `PiClient` is obvious)

- `snapshot(): PiThreadSnapshot`
- `send(input: { content: string; attachments?: PiImageContent[] })`
- `stop()`
- `subscribe(subscriber)` where the subscriber receives:
  - `event(ev: PiClientEvent)` and/or
  - keep `status` / `error` / `streamGeneration` if the UI still needs generation invalidation

Snapshot-first: every subscribe sends `{ type: "snapshot", snapshot }` then live `message_update` / `tool_execution_*` / `message_end` / `agent_end`. Same reconnect rule as react-pi: dropped socket does **not** abort the run.

`runOfficeTurn` already uses `session.buildContext().messages`. Keep that. Stop taking a client message array as model context. Client `send` only appends the new user row (`appendOfficeUserMessage` but with Pi `Message`, not `OfficeChatMessage`).

Delete in-memory `officeUiLog` as a second transcript. Derive UI from Session at snapshot time; stream from `onEvent`.

`office_chat` table: migrate-once stays (`migrateOfficeChatToSession`). After migrate, stop writing it. Do not drop in the same PR if old isolates still read it; drop in a follow-up once migrate is proven (guard: if `pi_session_entries` non-empty, ignore `office_chat`).

### Phase 3 — Project at the UI (web)

Replace the AI SDK runtime:

```tsx
// today
const chat = useOfficeChat(...)
const runtime = useAISDKRuntime(helpers, { adapters: { attachments } })

// target
const client = useMemo(() => createPiCapnpClient({ roomId }), [roomId])
const runtime = usePiRuntime({ client, adapters: { attachments } })
// or: reduce events → projectPiThreadMessages → useExternalStoreRuntime
```

- `createPiCapnpClient` lives in `apps/web/src/lib/` (apps wire adapters). It is a `PiClient`-shaped object over existing `officeRpcUrl(roomId)`.
- Keep `Thread` / `PresentToolUI` / `makeAssistantToolUI`. Those already want assistant-ui **tool-call parts**, which the Pi projection emits (`type: "tool-call"`, `toolName`, `args`, `result`). Today AISDKMessageConverter maps `tool-${name}` → that. After the switch, projection does it.
- Rewrite `chat-messages.ts` helpers (`lastOfficePreview`, `usedTools`, coalesce/queue) against `ThreadMessageLike` or projected parts. Do not import `UIMessage`.
- Sender: `withOfficeUserMetadata` writes Pi custom entry / projection `metadata.custom`, not `UIMessage.metadata`.
- Optimistic local user bubble: append a Pi `user` message in the reducer, or a `ThreadMessageLike` user row — not `seedOutgoingUserMessage` as `UIMessage`.
- Query cache (`office-messages.ts`) stores snapshots or projected messages; pick one and use it everywhere.

Composer mid-run: v1 may keep “wait until ready” (current status). react-pi’s steer/follow-up queue is **phase 6**, not required to drop AI SDK.

### Phase 4 — Group rooms

`room_chat` payload becomes a Pi `user` | `assistant` | `toolResult` JSON message (or a small `{ id, message }` wrapper). Group `runRoomTurn` on the **home** actor:

```ts
messages: contextFromGroupLog(payload.messages) // already Message[]
```

Delete `officeLogToPiMessages(payload.messages)`.

`RoomThread.tsx` uses the same Cap’n Web Pi client + projection as office. Group host still has no tools/model; it relays stream events from the home turn (`postRoomTurn` paths). Ensure those events are Pi events or a snapshot delta, not `OfficeChatMessage`.

### Phase 5 — Mobile

Same contract as web. Drop `UIMessage` / `useAISDKRuntime`. `@assistant-ui/react-native` stays if it can take a Pi runtime or ExternalStore; if `usePiRuntime` is web-only, use projection + whatever RN runtime already exists.

### Phase 6 — Delete the mix

Remove:

- `OfficeChatMessage`, `parseOfficeChatMessage(s)`, `officeLogToPiMessages`, `applyOfficeAgentEvent` UIMessage draft, `officeMessagesFromSessionEntries` fold-to-UIMessage (replace with snapshot → projection)
- `aiToolsToPi`, `resolveAiSdkToolResult` (if tools are native)
- `useAISDKRuntime`, `from "ai"` in web/mobile office/room files
- deps: `ai`, `@ai-sdk/react`, `@assistant-ui/ai-sdk` from `apps/web` and `apps/mobile` **if unused**
- `ai` from `apps/api` **if** Code Mode island no longer needs `ToolSet` at the module boundary. If `toolSetConnector` still needs it, `ai` stays **only** in `bot-execute.ts` / a `codemode-ai-island.ts` — not in `bot-actor.ts`, not in packages/core.

Grep gate (must be empty except documented island):

```
rg -n "from [\"']ai[\"']|UIMessage|useAISDKRuntime|ToolSet|aiToolsToPi|OfficeChatMessage" apps packages
```

### Phase 7 — Optional Pi surfaces (after the cut)

Not required to “leave AI SDK”:

- Mid-run steer / follow-up (`streamingBehavior`) matching react-pi composer table
- Thinking parts (`PiThinkingContent` → `reasoning`)
- Compaction / contextUsage meter
- Host-ui `confirm` / `select` (Pi HITL). Only if we productize it
- Image attachments as `PiImageContent` (react-pi is image-passthrough only)

---

## Code Mode island (explicit exception)

`@cloudflare/codemode/ai` `toolSetConnector` wants AI SDK `ToolSet`. Do not block the migration on Cloudflare shipping a Pi connector.

Allowed:

```
bot-execute.ts  →  toolSetConnector(ctx, { tools: pageToolSet })
                →  createCodemodeRuntime(...).  // internal
Pi AgentTool "execute"  →  runtime.execute(code)
```

Forbidden:

- `createAITools` result in that `ToolSet` (computer is not Code Mode)
- Exporting `ToolSet` from `getTools()` to the Pi loop
- Importing `tool` from `"ai"` in present / board / set_context / markdown **once those are AgentTools**. Page tools may exist twice briefly (AgentTool for the model **or** ToolSet for Code Mode) — prefer one implementation in `packages/core` (`runPresent`, `runPublicFetch`) called from both wrappers, then delete the `ai` wrapper.

---

## Tests (offline only)

Add/keep vitest, no live model:

| Case | Assert |
|---|---|
| `officeLogToPiMessages` replacement: Session branch → loop messages | assistant + toolResult preserved, no UIMessage |
| Generator tool result | drained JSON in Session; `jsonClone` fails closed |
| `apply` / reducer: text_delta + tool_execution_end | projection has text + tool-call `result` |
| Cap’n Web fixture / parse | snapshot + events, no `parts`/`output-available` |
| Migrate `office_chat` UIMessage JSON → Session | one-shot, skip if entries exist |
| Group wake | home `runPiTurn` gets `Message[]` from group log |
| Computer home dir | `ensureComputerHome` creates `/workspace` |
| `PresentToolUI` | still binds `present` via `makeAssistantToolUI` on projected tool-call |
| Existing `ScriptedAgentRuntime` / `pi-turn.test.ts` | still pass |

Do not start `computerUse` / headed browser unless asked. Web verification: vitest + existing web tests; if a thread component test exists, update fixtures from `UIMessage` to projected messages.

---

## Suggested PR slices

1. **Tools + JSON clone + `/workspace`** (Phase 1) — crash fix, still UIMessage UI
2. **Pi Cap’n Web on home + Session-only context** (Phase 2) — can temporarily project server-side to old `OfficeChatMessage` **only if** you must split PRs; prefer not to
3. **Web `usePiRuntime` / ExternalStore** (Phase 3)
4. **Group log + RoomThread** (Phase 4)
5. **Mobile + delete AI SDK office deps** (Phase 5–6)

Do not land Phase 3 on top of a server that still only emits UIMessage unless you keep a deprecated converter for one PR. Better: Phase 2+3 together if the diff is manageable.

---

## Acceptance checklist

- [ ] Home turn: `messages` argument to `runPiTurn` is `session.buildContext().messages` (Pi `Message[]`)
- [ ] Group wake: same, from group log parsed as Pi messages — no `officeLogToPiMessages`
- [ ] Subscribe → snapshot-first Pi events; reconnect does not abort
- [ ] No `AsyncGenerator` can be stored or broadcast (test)
- [ ] `/workspace` exists on a new computer VFS
- [ ] OfficeThread / RoomThread do not import `ai` or `useAISDKRuntime`
- [ ] `PresentToolUI` still renders cards from `present`
- [ ] `rg` gate above is clean except documented Code Mode island
- [ ] `pnpm test` / `pnpm check` (or the repo’s equivalent) pass
- [ ] AGENTS.md / rooms-plan.md / computers.md no longer say the office log is UIMessage / `office_chat` as the live store

---

## Implementer notes

- react-pi README “Composer run semantics” and “Host-UI requests” are **future product**, not the migration. The migration is: **canonical Pi + one projection + JSON wire + AgentTool**.
- `OwnedPiLine` (poke / REST guest) can stay `{ role, content: string }`. That is a different product surface. Do not force those through `UIMessage` or through the office Session.
- If `@assistant-ui/react-pi`’s `usePiRuntime` requires `listThreads`, implement a stub that returns the single current `roomId` thread. Do not build a Pi thread catalog UI.
- Cloudflare `createAITools` tool copy that mentions `/workspace` is why the model `list`s that path — keep cwd and VFS in agreement.
- When in doubt, open react-pi `messageProjection.ts` and match its fold rules rather than inventing a third message type.
