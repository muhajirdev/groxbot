# Rooms

Think is the **person**. A panel is a **place**. Those must not share one Durable Object.

## Why the office primitive is wrong for a group

`BotActor` extends Think. `useAgentChat({ name: botId })` treats that actor as the transcript. That is correct for Maya’s 1:1 office. It is the wrong object for “Steve, Hormozi, and Alexander at one table”:

- Think Session / `SessionManager` is many conversations **on one agent**, not many agents in one conversation.
- One DO is one queue. If the room *were* Think, the whole table would serialize and share one computer.
- Putting the panel in Steve’s Think SQLite makes Hormozi a guest in Steve’s head.

So: do not point group chat at Think. Do not name `BotActor` by `roomId`. Do not use Cloudflare Session as the room catalog. Do not add D1.

## Two durables

```
RoomActor [name = roomId]     not Think
  members, floor, ordered log, hibernated websockets
  wakes bots; never runs the model itself

BotActor  [name = botId]      Think
  computer, soul, queue, routines
  one turn when the room calls
```

| Object | Durable? | Key | Think? |
|---|---|---|---|
| Bot (person) | yes — `BotActor` | `botId` | yes |
| Room (place) | yes — `RoomActor` | `roomId` | **no** |
| Membership / listing | Postgres | workspace | no |
| Computer | built into the bot | `botId` | `@cloudflare/computer` `Workspace` |

`RoomActor` is a coordinator, the same job as `AppRuntime` for a doc: one writer, one log, many subscribers. It is **not** a bot doing impressions.

Postgres lists rooms and members (team data). The live transcript and “who has the floor” live on `RoomActor` (DO SQLite), with `seq` as the order. Same pattern as poke’s ordered log, but the hot object is the room, not a pair of bots.

## A turn

You speak in the room. The room decides who wakes (`@Steve`, go-around, or fail closed if several members and no target). It enqueues **that** `BotActor`. Steve reads a slice of the room log, thinks on his computer, streams a reply **back to the room**. The product transcript is the room. Steve’s Think session is working memory for the turn, not the catalog.

Steve and Hormozi can run at once (two actors). One bot in two rooms still queues on that bot. Nested poke-style waits must not re-enter the caller’s queue.

Computer pane: `focusedBotId`. The room has no screen.

## Office, later

Maya’s office becomes a room with one member. Same send path as a panel. Until that ships, v1 office may stay Think-on-`BotActor`. Do not grow a second transcript model; the target is one room type.

Poke (pair thread in Postgres) stays as agent-to-agent off to the side. A panel is not a poke.

## v1

Still one home office per bot. Do not ship `RoomActor` until 1:1 + computer work. When we do: `rooms.create` + members + `send({ roomId, text, targetBotId? })`, UI keyed on `roomId`, computer keyed on `botId`.

Scripted tests: `poke Lookout: …` still covers pair wake. Group tests send to a room and assert which `botId`s ran.
