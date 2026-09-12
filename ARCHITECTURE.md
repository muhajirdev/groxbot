# Architecture

**Groxbot** is fair-code **Grok Bot**: named teammates you message like people. Composio for Gmail/Slack/GitHub. Workspace-shared context and skills. BYOK models. groxbot.com is the hosted cloud.

UI: copy Grok Bot simplicity — [docs/grok-bot-ui.md](./docs/grok-bot-ui.md). Rooms later: [docs/rooms-plan.md](./docs/rooms-plan.md).

## Picture

```
  web / desktop / expo
          |
          v
  API Worker  (Hono + oRPC)
          |
          +---- D1  (team: auth, bots, rooms, poke threads)
          |
          +---- RoomActor [name = roomId]   <-- person: Agent + Pi + Computer
          |       person’s own room (bots.homeRoomId): queue / schedule / one turn
          |       Pi Session (sessions/entries) + Cap’n Web /rooms/:roomId/rpc
          |       computer = @cloudflare/computer Workspace + Worker shell
          |       group room: members, floor, room log; guest Pi via home door
          |
          '---- AppRuntime [name = appId]   <-- not the person
                  document + Gadget facet
                  wss://…/apps/:id/rpc
```

| Thing | Key | What it is |
| --- | --- | --- |
| Bot | `botId` | The person. Roster/soul/computer oRPC key. Their `RoomActor` is named `homeRoomId`. Pi runs the turn. |
| Room | `roomId` | A place. Same Durable Object class. Person iff `bots.homeRoomId` matches. Group runs guest Pi as the seated bot; computer/memory stay on home behind a door. 1:1 is that bot’s own room. |
| Thread | D1 `threadId` | v1 poke / guest. Listing + membership. |
| Office log | that home room | Pi Session (`sessions` / `entries`) on DO SQLite. |
| App | `appId` | Live doc. Own Durable Object. |
| Computer | `botId` | Built into the home room. `@cloudflare/computer` `Workspace` + Worker shell on `RoomActor`. Sell it. Not a second Durable Object. |

## Locked

- **Durable person = that bot’s own `RoomActor`.** `getAgentByName(env.ROOM_ACTOR, homeRoomId)`. Do not name this instance `botId`. Do not bring back `BotActor`. Do not store `rooms.kind`.
- **Durable group = a different `RoomActor`.** Same class. Person vs group is `loadBot()` / `bots.homeRoomId`. Owns the log, members, floor, and guest Pi. Computer and grown soul stay on home (`/door/*`). See [docs/rooms-plan.md](./docs/rooms-plan.md).
- **Office log on the person’s room.** Pi Session (`sessions` / `entries`) on DO SQLite. `office_chat` is migrate-only. v1 is **one** own room per bot. A poke is still a D1 thread that enqueues onto that room. Do not use a session catalog as the office. Pi is the **loop** (`runAgentLoopContinue`); it does not replace the person instance or run on the group.
- **Each app has its own Durable Object.** Talk → chat card → Open. Listing from cards, not a D1 apps table.
- **Computer is the bot.** Each teammate has a computer (`@cloudflare/computer` `Workspace` on the home `RoomActor`, Worker shell for bash). Sell that. No `computers` table, no shared vs isolated hire, no takeover, no `computer.sleep`, no Computer DO.
- **D1** is the team catalog (auth, bots, rooms, poke threads). Office UI is assistant-ui over Cap’n Web (`/rooms/:roomId/rpc`).
- **One queue per home room.** Two humans in one office share it. Two bots in a poke are two queues.
- Product is **Cloudflare Workers** + D1.

## Wake a bot

- `run.continue` — user messaged (that bot’s queue)
- Routines — Agents `this.schedule` on the home `RoomActor`. The office UI and Code Mode `routines` connector call `schedule` / `listSchedules` / `cancelSchedule`; the callback appends a user row and starts a Pi turn.

Do not run the brain from Worker Cron Triggers. Do not store routine clocks in D1.

## Composition

Kernel in `packages/*` does not import `cloudflare:workers`. The Worker constructs fills:

```
createApp(env, { db, enqueue, initApp, email })
createWakeHandlers({ db, runtime, enqueue, bindRuntime, pluginTools })
```

`enqueue` is `getAgentByName` + Agents `queue` / `schedule` (or a test function). `initApp` is the `AppRuntime` stub. `email` is `env.EMAIL`. Hosted models bind `env.AI` in home `RoomActor` boot.

## One deployment

| | groxbot.com |
| --- | --- |
| Marketing | `apps/landing` |
| Office SPA | `apps/web` |
| API | `apps/api` + D1 binding. Local: `wrangler dev` |
| Brain | Pi `runAgentLoopContinue` on the home `RoomActor` for v1 office and owned arrays (poke / guest / REST). Tests: `ScriptedAgentRuntime` |
| Apps | `AppRuntime` per `appId` |
| Data | Cloudflare D1 |
| Auth email | Worker `EMAIL` (`send_email`) |
| Hosted models | Worker `AI` through AI Gateway |

Clients share **one oRPC contract**. Desktop loads the web app. Product mobile is Expo. `apps/ios` is a native SwiftUI companion on the same `/rpc` + Cap’n Web office path.

## Live apps

Live apps are workspace-owned collaborative documents, not files on a bot's
computer and not rows in an apps catalog.

1. A teammate calls `stamp_app`; the Worker allocates an `appId` and initializes
   `AppRuntime` with the authenticated `workspaceId`, template, and title.
2. `AppRuntime` stamps `client.js` and `server.js`. The latter exports `Gadget`
   and runs as a Dynamic Worker Facet; its SQLite state is the document source
   of truth.
3. The tool result is rendered as an app card in the room log. `apps.list`
   derives sidebar chrome from those cards; it does not load or save documents.
4. Open connects the iframe through the parent-held authenticated WebSocket at
   `/apps/:appId/rpc`. The iframe receives a Cap'n Web `MessagePort`; it never
   owns credentials or a second in-browser document model.

An `appId` is claimed by its workspace on first initialization. Initialization
is retry-safe and cannot change the workspace or template after the app becomes
live. App RPC checks the signed-in actor's workspace before exposing either the
UI bundle or the `Gadget` RPC target. Workspace purge deletes both the
`AppRuntime` supervisor state and the facet's separate SQLite database.

## Out of v1

A separate Computer Durable Object / `computers` table, `SessionManager`, custom `SessionProvider` / `PostgresSessionProvider` as the office catalog, a generic gadget archive/catalog system, gatekeepers, Rivet/agentOS as a deploy target, Polar billing. The v1 `Gadget` class is only the Dynamic Worker Facet behind each `AppRuntime`. Group rooms: [docs/rooms-plan.md](./docs/rooms-plan.md) (`RoomActor` coordinator, not the model on the group).
