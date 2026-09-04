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
          +---- BotActor [name = botId]     <-- Agent + Pi office + Computer
          |       queue / schedule / one turn
          |       office_chat SQLite + Cap’n Web /bots/:botId/rpc
          |       computer = @cloudflare/computer Workspace + Worker shell
          |
          +---- RoomActor [name = roomId]   <-- later, not the person
          |       members, floor, room log, websockets
          |
          '---- AppRuntime [name = appId]   <-- not the person
                  document + Gadget facet
                  wss://…/apps/:id/rpc
```

| Thing | Key | What it is |
| --- | --- | --- |
| Bot | `botId` | The person. One Agents Durable Object. Pi runs the turn. |
| Room | `roomId` | The place (later). Own Durable Object; does **not** run the model. v1 office is Pi-on-bot. |
| Thread | Postgres `threadId` | v1 poke / guest. Listing + membership. |
| Office log | that bot | DO SQLite `office_chat`. Not a Think Session. |
| App | `appId` | Live doc. Own Durable Object. |
| Computer | `botId` | Built into the bot. `@cloudflare/computer` `Workspace` + Worker shell on `BotActor`. Sell it. Not a second Durable Object. |

## Locked

- **Durable person = bot = `BotActor`.** `getAgentByName(env.BOT_ACTOR, botId)`. Never name this actor a `roomId`.
- **Durable place = room (later), not the person.** `RoomActor` coordinates the log, members, floor, and websockets. See [docs/rooms-plan.md](./docs/rooms-plan.md).
- **Office log on the bot.** DO SQLite `office_chat`. v1 is **one** home office. A poke is still a Postgres thread that enqueues onto that bot. Do not use a Think Session as the catalog. Pi is the **loop** (`runAgentLoopContinue`); it does not replace the person Durable Object or the later room Durable Object.
- **Each app has its own Durable Object.** Talk → chat card → Open. Listing from cards, not a Postgres apps table.
- **Computer is the bot.** Each teammate has a computer (`@cloudflare/computer` `Workspace` on `BotActor`, Worker shell for bash). Sell that. No `computers` table, no shared vs isolated hire, no takeover, no `computer.sleep`, no Computer DO.
- **Postgres** is the team catalog (auth, bots, threads, messages, skills). Office UI is assistant-ui over Cap’n Web (`/bots/:botId/rpc`), not Think’s `useAgentChat`.
- **One queue per bot.** Two humans in one office share it. Two bots in a poke are two queues.
- Product is **Cloudflare Workers** + Neon.

## Wake a bot

- `run.continue` — user messaged (that bot’s queue)
- Routines — Agents `this.schedule` on `BotActor`. The office UI and Code Mode `routines` connector call `schedule` / `listSchedules` / `cancelSchedule`; the callback appends a user row and starts a Pi turn.

Do not run the brain from Worker Cron Triggers. Do not store routine clocks in Postgres.

## Composition

Kernel in `packages/*` does not import `cloudflare:workers`. The Worker constructs fills:

```
createApp(env, { db, enqueue, initApp, email })
createWakeHandlers({ db, runtime, enqueue, bindRuntime, pluginTools })
```

`enqueue` is `getAgentByName` + Agents `queue` / `schedule` (or a test function). `initApp` is the `AppRuntime` stub. `email` is `env.EMAIL`. Hosted models bind `env.AI` in `BotActor` boot.

## One deployment

| | groxbot.com |
| --- | --- |
| Marketing | `apps/landing` |
| Office SPA | `apps/web` |
| API | `apps/api` + Neon HTTP. Local: `wrangler dev` |
| Brain | Pi `runAgentLoopContinue` on `BotActor` for v1 office and owned arrays (poke / guest / REST). Tests: `ScriptedAgentRuntime` |
| Apps | `AppRuntime` per `appId` |
| Data | Neon Postgres |
| Auth email | Worker `EMAIL` (`send_email`) |
| Hosted models | Worker `AI` through AI Gateway |

Clients share **one oRPC contract**. Desktop loads the web app. Expo later.

## Out of v1

A separate Computer Durable Object / `computers` table, `SessionManager`, custom `SessionProvider` / `PostgresSessionProvider` as the office catalog, gadgets, gatekeepers, Rivet/agentOS as a deploy target, Think `chat()` / `useAgentChat` as the office loop, Polar billing. Group rooms: [docs/rooms-plan.md](./docs/rooms-plan.md) (`RoomActor` coordinator, not the model on the room).
