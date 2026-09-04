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
          +---- Neon  (team: auth, bots, threads, messages, skills)
          |
          +---- RoomActor [name = roomId]   <-- person: Agent + Pi + Computer
          |       person’s own room (bots.homeRoomId): queue / schedule / one turn
          |       office_chat SQLite + Cap’n Web /rooms/:roomId/rpc
          |       computer = @cloudflare/computer Workspace + Worker shell
          |       group room: members, floor, room log; wakes those home rooms
          |
          '---- AppRuntime [name = appId]   <-- not the person
                  document + Gadget facet
                  wss://…/apps/:id/rpc
```

| Thing | Key | What it is |
| --- | --- | --- |
| Bot | `botId` | The person. Roster/soul/computer oRPC key. Their `RoomActor` is named `homeRoomId`. Pi runs the turn. |
| Room | `roomId` | A place. Same Durable Object class. Person iff `bots.homeRoomId` matches; a group does **not** run the model. 1:1 is that bot’s own room. |
| Thread | Postgres `threadId` | v1 poke / guest. Listing + membership. |
| Office log | that home room | DO SQLite `office_chat`. |
| App | `appId` | Live doc. Own Durable Object. |
| Computer | `botId` | Built into the home room. `@cloudflare/computer` `Workspace` + Worker shell on `RoomActor`. Sell it. Not a second Durable Object. |

## Locked

- **Durable person = that bot’s own `RoomActor`.** `getAgentByName(env.ROOM_ACTOR, homeRoomId)`. Do not name this instance `botId`. Do not bring back `BotActor`. Do not store `rooms.kind`.
- **Durable group = a different `RoomActor`.** Same class. Person vs group is `loadBot()` / `bots.homeRoomId`. Coordinates the log, members, floor, and websockets. Never runs Pi. See [docs/rooms-plan.md](./docs/rooms-plan.md).
- **Office log on the person’s room.** DO SQLite `office_chat`. v1 is **one** own room per bot. A poke is still a Postgres thread that enqueues onto that room. Do not use a session catalog as the office. Pi is the **loop** (`runAgentLoopContinue`); it does not replace the person instance or run on the group.
- **Each app has its own Durable Object.** Talk → chat card → Open. Listing from cards, not a Postgres apps table.
- **Computer is the bot.** Each teammate has a computer (`@cloudflare/computer` `Workspace` on the home `RoomActor`, Worker shell for bash). Sell that. No `computers` table, no shared vs isolated hire, no takeover, no `computer.sleep`, no Computer DO.
- **Postgres** is the team catalog (auth, bots, threads, messages, skills). Office UI is assistant-ui over Cap’n Web (`/rooms/:roomId/rpc`).
- **One queue per home room.** Two humans in one office share it. Two bots in a poke are two queues.
- Product is **Cloudflare Workers** + Neon.

## Wake a bot

- `run.continue` — user messaged (that bot’s queue)
- Routines — Agents `this.schedule` on the home `RoomActor`. The office UI and Code Mode `routines` connector call `schedule` / `listSchedules` / `cancelSchedule`; the callback appends a user row and starts a Pi turn.

Do not run the brain from Worker Cron Triggers. Do not store routine clocks in Postgres.

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
| API | `apps/api` + Neon HTTP. Local: `wrangler dev` |
| Brain | Pi `runAgentLoopContinue` on the home `RoomActor` for v1 office and owned arrays (poke / guest / REST). Tests: `ScriptedAgentRuntime` |
| Apps | `AppRuntime` per `appId` |
| Data | Neon Postgres |
| Auth email | Worker `EMAIL` (`send_email`) |
| Hosted models | Worker `AI` through AI Gateway |

Clients share **one oRPC contract**. Desktop loads the web app. Expo later.

## Out of v1

A separate Computer Durable Object / `computers` table, `SessionManager`, custom `SessionProvider` / `PostgresSessionProvider` as the office catalog, gadgets, gatekeepers, Rivet/agentOS as a deploy target, Polar billing. Group rooms: [docs/rooms-plan.md](./docs/rooms-plan.md) (`RoomActor` coordinator, not the model on the group).
