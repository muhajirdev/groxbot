# Rooms

The bot is the **person**. A panel is a **place**. Those must not share one Durable Object.

## Why the office primitive is wrong for a group

`BotActor` extends Agents `Agent`. Cap’n Web `/bots/:botId/rpc` treats that actor as the transcript. That is correct for Maya’s 1:1 office. It is the wrong object for “Steve, Hormozi, and Alexander at one table”:

- `office_chat` / one queue is many turns **on one agent**, not many agents in one conversation.
- One DO is one queue. If the room *were* the person, the whole table would serialize and share one computer.
- Putting the panel in Steve’s SQLite makes Hormozi a guest in Steve’s head.

So: do not point group chat at `BotActor`. Do not name `BotActor` by `roomId`. Do not use Cloudflare Session as the room catalog. Do not add D1.

## Cloudflare OS uses Pi. That does not make Pi the room.

[Cloudflare OS](https://github.com/cloudflare/cloudflare-os) credits [`pi-agent-core`](https://pi.dev/) for “every LLM provider with one API.” The source is more specific than the README:

- The durable is `OverseerDurableObject` — **the workspace (place)**. Chats are `chatId` rows on that DO. Gadgets are other DOs. Users are other DOs.
- Pi is not a Durable Object. Each turn rebuilds an in-memory `AgentContext` from the Overseer chat log, then calls `runAgentLoopContinue`. They **rejected** Pi’s stateful `Agent` class. Resume replays the log; the API token is re-fetched from the user DO (not stored on the turn record).
- One coding agent for the desk, Code Mode, sequential tools, 30-step cap. `AgentSpawner` still calls back into the same Overseer. Not a panel of named people with their own computers.
- They migrated **off Vercel AI SDK** onto Pi. OS already had a custom `AiChatMessage` log and a frontend they refused to touch (`plans/pi-impl.md`: “frontend: zero changes”).

Groxbot uses Pi as the loop on the **person**:

- **BotActor** is the v1 office person: Agents `Agent` (not Think), Computer `Workspace` + Worker shell, DO SQLite `office_chat`, assistant-ui over Cap’n Web (`/bots/:botId/rpc`).
- **Pi** is the turn engine: `runAgentLoopContinue({ systemPrompt, messages })`. Soul is the stable system-prompt prefix (Steve and Hormozi must not share that prefix). The room/office log is the suffix. Hosted REST / poke / guest turns use the same loop.
- Do **not** put the model on `RoomActor` (that would serialize the table and share one computer). Do **not** use Pi’s stateful `Agent` class as the room. The OS lesson for a panel is the Overseer shape: **place owns the log; the loop is a guest on the person.**

## Two durables

```
RoomActor [name = roomId]     not the person, not Pi
  members, floor, ordered log, hibernated websockets
  wakes bots; never runs the model itself

BotActor  [name = botId]      Agent + Pi + Computer
  computer, soul, queue, routines, office_chat
  one turn when the room calls
```

| Object | Durable? | Key | Model? |
|---|---|---|---|
| Bot (person) | yes — `BotActor` | `botId` | yes — Pi |
| Room (place) | yes — `RoomActor` | `roomId` | **no** |
| Membership / listing | Postgres | workspace | no |
| Computer | built into the bot | `botId` | `@cloudflare/computer` `Workspace` |

`RoomActor` is a coordinator, the same job as `AppRuntime` for a doc: one writer, one log, many subscribers. It is **not** a bot doing impressions.

Postgres lists rooms and members (team data). The live transcript and “who has the floor” live on `RoomActor` (DO SQLite), with `seq` as the order. Same pattern as poke’s ordered log, but the hot object is the room, not a pair of bots.

## A turn

You speak in the room. The room decides who wakes (`@Steve`, go-around, or fail closed if several members and no target). It enqueues **that** `BotActor`. Steve reads a slice of the room log, runs an owned Pi turn with **his** soul as `systemPrompt`, streams a reply **back to the room**. The product transcript is the room. Steve’s `office_chat` stays v1 office working memory, not the panel catalog.

Steve and Hormozi can run at once (two actors). One bot in two rooms still queues on that bot. Nested poke-style waits must not re-enter the caller’s queue.

Computer pane: `focusedBotId`. The room has no screen.

## Office, later

Maya’s office becomes a room with one member. Same send path as a panel. Until that ships, v1 office stays Pi-on-`BotActor`. Do not grow a second transcript model; the target is one room type.

Poke (pair thread in Postgres) stays as agent-to-agent off to the side. A panel is not a poke.

## v1

Still one home office per bot. Do not ship `RoomActor` until 1:1 + computer work. When we do: `rooms.create` + members + `send({ roomId, text, targetBotId? })`, UI keyed on `roomId`, computer keyed on `botId`.

Scripted tests: `poke Lookout: …` still covers pair wake. Group tests send to a room and assert which `botId`s ran.
