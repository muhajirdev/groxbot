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
          +---- BotActor [name = botId]     <-- Think + Pi owned turns
          |       queue / schedule / one turn
          |       computer = @cloudflare/computer Workspace + Worker shell
          |
          +---- RoomActor [name = roomId]   <-- later, not Think
          |       members, floor, room log, websockets
          |
          '---- AppRuntime [name = appId]   <-- not Think
                  document + Gadget facet
                  wss://…/apps/:id/rpc
```

| Thing | Key | What it is |
| --- | --- | --- |
| Bot | `botId` | The person. One Think Durable Object. |
| Room | `roomId` | The place (later). Own Durable Object, **not** Think. v1 office is still Think-on-bot. |
| Thread | Postgres `threadId` | v1 poke / guest. Listing + membership. |
| Session | that bot | Think working memory on `BotActor`. Not the panel catalog. |
| App | `appId` | Live doc. Own Durable Object. |
| Computer | `botId` | Built into the bot. `@cloudflare/computer` `Workspace` + Worker shell on `BotActor`. Sell it. Not a second Durable Object. |

## Locked

- **Durable person = bot = Think.** `getAgentByName(env.BOT_ACTOR, botId)`. Never name this actor a `roomId`.
- **Durable place = room (later), not Think.** `RoomActor` coordinates the log, members, floor, and websockets. See [docs/rooms-plan.md](./docs/rooms-plan.md).
- **Think Session on the bot.** Default DO SQLite. v1 is **one** session (home office). A poke is still a Postgres thread that enqueues onto that bot. Do not use Session as the room catalog. Pi is the **loop** for a message array you own (`runAgentLoopContinue`); it does not replace the person Durable Object or the later room Durable Object.
- **Each app has its own Durable Object.** Talk → chat card → Open. Listing from cards, not a Postgres apps table.
- **Computer is the bot.** Each teammate has a computer (`@cloudflare/computer` `Workspace` on `BotActor`, Worker shell for bash). Sell that. No `computers` table, no shared vs isolated hire, no takeover, no `computer.sleep`, no Computer DO.
- **Postgres** is the team catalog (auth, bots, threads, messages, skills). Office UI is oRPC, not Think’s `useAgentChat`.
- **One queue per bot.** Two humans in one office share it. Two bots in a poke are two queues.
- Product is **Cloudflare Workers** + Neon.

## Wake a bot

- `run.continue` — user messaged (that bot’s queue)
- Routines — Agents `this.schedule` on `BotActor`. The office UI and Code Mode `routines` connector call `schedule` / `listSchedules` / `cancelSchedule`; the callback `submitMessages` a Think turn.

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
| Brain | Think `chat()` on `BotActor` for v1 office; Pi `runAgentLoopContinue` for owned arrays (poke / guest / REST). Tests: `ScriptedAgentRuntime` |
| Apps | `AppRuntime` per `appId` |
| Data | Neon Postgres |
| Auth email | Worker `EMAIL` (`send_email`) |
| Hosted models | Worker `AI` through AI Gateway |

Clients share **one oRPC contract**. Desktop loads the web app. Expo later.

## Out of v1

A separate Computer Durable Object / `computers` table, `SessionManager`, custom `SessionProvider` / `PostgresSessionProvider` as the office catalog, gadgets, gatekeepers, Rivet/agentOS as a deploy target, Think as the office UI, Polar billing. Group rooms: [docs/rooms-plan.md](./docs/rooms-plan.md) (`RoomActor` coordinator, not Think on the room).
