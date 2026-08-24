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
          +---- BotActor [name = botId]     <-- Think
          |       queue / schedule / one turn
          |       session per thread (office, poke)
          |
          '---- AppRuntime [name = appId]   <-- not Think
                  document + Gadget facet
                  wss://…/apps/:id/rpc
```

| Thing | Key | What it is |
| --- | --- | --- |
| Bot | `botId` | The brain. One Think Durable Object. |
| Thread | Postgres `threadId` | A Think session on that bot. Not a Durable Object. |
| App | `appId` | Live doc. Own Durable Object. |
| Computer | — | **Not a product.** Removed. |

## Locked

- **Durable = bot = Think.** `getAgentByName(env.BOT_ACTOR, botId)`.
- **One Think, many sessions.** Office (v1 home thread) is the default session. Extra office threads later are more sessions on the same actor. A poke is still that bot’s session; the other teammate has their own Think.
- **Each app has its own Durable Object.** Talk → chat card → Open. Listing from cards, not a Postgres apps table.
- **No Computer.** No desk row, no shared vs isolated hire, no takeover, no `computer.sleep`. Files later are Think workspace on the bot actor.
- **Postgres** is the team catalog (auth, bots, threads, messages, skills). Office UI is oRPC, not Think’s `useAgentChat`.
- **One queue per bot.** Two humans in one office share it. Two bots in a poke are two queues.
- Product is **Cloudflare Workers** + Neon. Self-host / Flue / Pi are not v1.

## Wake a bot

- `run.continue` — user messaged (that bot’s queue)
- `routine.wakeup` — cron metadata in Postgres; enqueue onto that actor

Do not run the brain from Worker Cron Triggers.

## Composition

Kernel in `packages/*` does not import `cloudflare:workers`. The Worker constructs fills:

```
createApp(env, { db, enqueue, initApp })
createWakeHandlers({ db, runtime, enqueue, bindRuntime, pluginTools })
```

`enqueue` is `getAgentByName` + Agents `queue` / `schedule` (or a test function). `initApp` is the `AppRuntime` stub.

## One deployment

| | groxbot.com |
| --- | --- |
| Marketing | `apps/landing` |
| Office SPA | `apps/web` |
| API | `apps/api` + Neon HTTP. Local: `wrangler dev` |
| Brain | Think on `BotActor` (tests: scripted) |
| Apps | `AppRuntime` per `appId` |
| Data | Neon Postgres |
| Auth email | Cloudflare Email Sending |

Clients share **one oRPC contract**. Desktop loads the web app. Expo later.

## Out of v1

Computer as a product, gadgets, gatekeepers, Rivet/agentOS as a deploy target, Flue, Pi, Think as the office UI, Polar billing, multi-bot rooms.
