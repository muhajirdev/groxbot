# Rooms

The bot is the **roster person**. A room is a **place**. They share one Durable Object **class**, not one instance. There is no stored `rooms.kind`.

## One class, two shapes

`RoomActor` extends Agents `Agent`. Instance name is always `roomId`. `bots.homeRoomId` is that person’s own `rooms.id`. Listing hides rooms whose id is someone’s `homeRoomId`. The actor is a person iff `loadBot()` finds a bot (or stored `botId`); otherwise it is a group.

| Instance | Role | Model? | Files |
|---|---|---|---|
| That bot’s own room | the person | yes — 1:1 office Pi, computer, grown soul | that bot’s computer |
| Group room | the table | yes — guest Pi as the seated bot | shared papers; computer via home door |

- Cap’n Web is one path: `/rooms/:roomId/rpc`. There is no `/bots/:botId/rpc`.
- Conversation URL is `/$slug/room/$roomId`. 1:1 is `/$slug/room/$homeRoomId`. Old `/bot/$botId` bookmarks redirect.
- Cache key is `roomId`. Computer pane stays `focusedBotId`.
- Hire creates the bot, that bot’s own room, and inits that `RoomActor`.
- Group members still join by `botId`. Wake target is that bot’s **home room id** (door), not a second person instance.
- The group runs Pi as the seated teammate. Home stays the office + computer + `set_context` blobs. Group calls `/door/context` and `/door/tool`.

Do not bring back a `BotActor` TypeScript class. The provisioned Cloudflare SQLite class is still named `BotActor` (v1) so preview `versions upload` can succeed; the Worker binding and product name are `ROOM_ACTOR` / `RoomActor`. Do not name the person instance by `botId`. Do not move the computer off home. Do not store `rooms.kind`. Do not use Cloudflare Session as the office catalog. Do not add D1.

## Cloudflare OS uses Pi. That does not make Pi the room.

[Cloudflare OS](https://github.com/cloudflare/cloudflare-os) credits [`pi-agent-core`](https://pi.dev/) for “every LLM provider with one API.” The source is more specific than the README:

- The durable is `OverseerDurableObject` — **the workspace (place)**. Chats are `chatId` rows on that DO. Gadgets are other DOs. Users are other DOs.
- Pi is not a Durable Object. Each turn rebuilds an in-memory `AgentContext` from the Overseer chat log, then calls `runAgentLoopContinue`. They **rejected** Pi’s stateful `Agent` class. Resume replays the log; the API token is re-fetched from the user DO (not stored on the turn record).
- One coding agent for the desk, Code Mode, sequential tools, 30-step cap. `AgentSpawner` still calls back into the same Overseer. Not a panel of named people with their own computers.

Groxbot uses Pi as the loop. Office Pi stays on the **person’s own room**. Group Pi is a guest on the **place**, using that person’s door:

- **Person `RoomActor`** is the office person: Agents `Agent`, Computer `Workspace` + Worker shell, Pi Session (`sessions` / `entries`, sqlite-node layout) on DO SQLite, assistant-ui over Cap’n Web (`/rooms/:homeRoomId/rpc`) streaming Pi snapshots + events.
- **Pi** is the turn engine: `runAgentLoopContinue({ systemPrompt, messages })`. Soul is the stable system-prompt prefix (Steve and Hormozi must not share that prefix). The room/office log is the suffix. Hosted REST / poke / guest turns use the same loop.
- **Group `RoomActor`** owns the shared log, members, floor, and websockets. It **runs** the seated bot’s Pi turn. Soul overlay, memory, and computer stay on home and are reached through the person door (`/door/context`, `/door/tools`, `/door/tool`).

```
RoomActor  [name = homeRoomId]   person (homeRoomId match)   Agent + office Pi + Computer + door
RoomActor  [name = roomId]       group (no matching bot)     log, members, floor; guest Pi via door
```

| Object | Durable? | Key | Model? |
|---|---|---|---|
| Bot (person) | yes — own `RoomActor` | `homeRoomId` (DO), `botId` (roster) | yes — Pi |
| Room (place) | yes — group `RoomActor` | `roomId` | **guest Pi** |
| Membership / listing | Postgres | workspace | no |
| Computer | built into the person’s room | `botId` oRPC → home instance | `@cloudflare/computer` `Workspace` |

Postgres lists rooms and members (team data). The live transcript and “who has the floor” live on that `RoomActor` (DO SQLite), with `seq` as the order.

## A turn

You speak in the group. The group decides who wakes (`@Steve`, go-around, or fail closed if several members and no target). It runs Pi **here** as Steve: roster prompt from Postgres, overlay/memory/computer through Steve’s home door. Replies stay on the group log. Steve’s home Pi Session stays 1:1 office. Office and group can run at once; file ops on the computer still serialize on home.

Steve and Hormozi in one group share the group isolate (one floor at a time). Nested poke-style waits must not re-enter the caller’s queue.

Computer pane: `focusedBotId`. The group has no screen — papers live on the group instance.

## v1

1:1 office is already that bot’s own room with one member. Same URL and Cap’n Web path as a group. Poke (pair thread in Postgres) stays as agent-to-agent off to the side. A panel is not a poke.

Scripted tests: `poke Lookout: …` still covers pair wake. Group tests send to a room and assert which `botId`s ran — computer/memory go through that bot’s home door.
