# Client cache (web)

Web’s “instant office” is **one TanStack QueryClient**. TanStack DB collections are live rows over that client. IndexedDB is a **whitelist dehydrate** of the same client. localStorage is only for **sync chrome** Query persist does not cover.

Desktop is Electron around this web app, so it gets the same cache. Mobile has a QueryClient and **no** IndexedDB persist.

Source of truth is never the browser:

| Data | Truth |
|---|---|
| Team, bots, members, models | Postgres |
| Office chat | DO SQLite `office_chat` on the home `RoomActor`, streamed over Cap’n Web |
| Board / room chat | DO SQLite `room_chat` on the board `RoomActor`, streamed over Cap’n Web |
| This bot’s files | `@cloudflare/computer` `Workspace` on the home `RoomActor` |
| Office knowledge | R2 `{workspaceId}/…` |

R2 `_search/index.json` and `_links/index.json` are **Worker snapshots**, not this cache. See [knowledge-search.md](./knowledge-search.md).

## Boot

`apps/web/src/main.tsx` imports `./lib/office-persist` **before** `createRoot`. That module `await`s `persistQueryClient` restore, then `hydrateBotPreviews()`. First React paint already has the restored whitelist.

Do not move persist after paint. Do not add a second IndexedDB schema, Dexie, Zustand persist, or a custom `SessionProvider` catalog.

## Layers

```
IndexedDB  groxbot-query-cache   (idb-keyval, throttle 1s)
     ▲  dehydrate whitelist of successful queries
QueryClient  apps/web/src/lib/orpc.ts
     ▲  same queryKey
TanStack DB  apps/web/src/lib/collections.ts
     │  query collections: bots, rooms, apps, plugins, mcp
     └  local-only: thread-meta  (RAM, not persisted)
localStorage / sessionStorage    prefs + workspace name + invite
```

Code:

| Piece | File |
|---|---|
| QueryClient + oRPC utils | `apps/web/src/lib/orpc.ts` |
| Persist whitelist + restore | `apps/web/src/lib/office-persist.ts` |
| Office transcript bag (`office-messages`) | `apps/web/src/lib/office-messages.ts` |
| Collections | `apps/web/src/lib/collections.ts` |
| Roster preview overlay | `apps/web/src/lib/bot-preview.ts` |
| Workspace name hint | `apps/web/src/lib/workspace-switcher.ts` |
| Theme / notify / review prefs | `apps/web/src/lib/theme.ts`, `prefs.ts` |

## QueryClient defaults

From `orpc.ts`: `staleTime` 30s, `gcTime` 30m, `retry: false`, `refetchOnWindowFocus: false`.

Auth session (`["auth", "session"]` in `session.ts`) is **memory only**, `staleTime` 5m. Persist explicitly skips it.

Catalog collections set `gcTime` to `OFFICE_MESSAGES_GC_TIME` (7 days) so rows outlive the persist `maxAge`. In-memory-only reads (file bodies, `me`, models) keep the default 30m.

## What IndexedDB keeps

`shouldDehydrateOfficeQuery` — **success only**. Key `groxbot-query-cache`. `maxAge` = 7 days. `OFFICE_CACHE_BUSTER` (`"6"` today): bump this when the dehydrated shape is incompatible; it wipes every browser cache.

| Query | Why |
|---|---|
| `["office-messages", botId]` | Last office transcript per bot. Seeded into `useOfficeChat`. Written with `setOfficeMessages`, not a `queryFn`. |
| `["room-messages", roomId]` | Last board log per room. Seeded into `useRoomChat`. Do not key this by `botId`. |
| `bots.list` | Roster. Query collection. Last line overlaid from the office transcript cache so a refetch that sends `""` does not blank the sidebar. |
| `rooms.list` | Board catalog. Query collection. Last line overlaid from the room transcript cache. |
| `apps.list` | Live app cards. Query collection. |
| `plugins.list` / `mcp.list` | Connectors. Query collections. Refetch on window focus. |
| `knowledge.list` | Office tree. `useQuery` only (no collection). |
| `computer.list` `{ botId }` | Each teammate’s file tree. Matcher strips `botId`/`path` so every bot’s list shares the procedure. **Not** `computer.download`. |

Writes into a query collection (`writeUpsert` / `writeUpdate` / `writeDelete`) go through QueryClient, then into IDB on the next persist throttle. `patchBot({ lastPreview })` is that path.

## What IndexedDB must not keep

| Query | Why |
|---|---|
| `["auth", "session"]` | Cookie session. Routing. |
| `orpc.me` | Email, `needsModel`, `needsWorkspace`. Stale `me` would mis-route. |
| `knowledge.graph` | Derived; cheap GET. |
| File bodies (`knowledge` / `computer` read + download) | Large; refetch with 60s stale. |
| `routines.list`, `models.get`, members | Settings, not the office shell. |

Tests: `apps/web/src/lib/office-persist.test.ts`. Node has no IndexedDB (`officeCacheEnabled() === false`).

## TanStack DB

**Query collections** (`queryCollectionOptions`) bind a list RPC to rows. UI uses `useLiveQuery`. Route loaders call `botsCollection.preload()` — after persist restore that is a cache hit.

Optimistic hire / plugin / MCP patches use `collection.utils.write*`. If sync has not started, those helpers throw; callers catch.

**`threadMetaCollection`** is `localOnlyCollectionOptions`. Cursor, working, error, opening. RAM only. Lost on reload. Do not persist it.

Do not add a collection that is the office catalog. The catalog is `bots.list` plus the office transcript bag. Do not add `SessionManager` or a Cloudflare Session list.

## Office keep-alive

`office-keepalive.ts` is **not** a data cache. Chat keeps up to 8 office trees mounted so switching a teammate is a visibility toggle, not a remount. First visit is still cold; the IDB transcript is the seed.

## Sync chrome (localStorage)

Query persist is async-to-disk and **awaited** before paint, so catalog and threads do not flash. Anything **not** on the whitelist still comes from the network on first `useQuery`.

`orpc.me` is not persisted (see above). The top-left office name would otherwise render `"Workspace"` until `me` returns. That name is a tiny localStorage hint:

- Key `groxbot.workspace` → `{ id, name }`
- Read synchronously in `WorkspaceSwitcher`
- Write when live `me` (or a rename / create / join) has both id and name
- Ignore the cached name if the live `workspaceId` differs
- Cleared on sign-out with the rest of the client store

Other keys (not Query):

| Key | |
|---|---|
| `groxbot.theme` | Appearance |
| `groxbot.notify.{botId}` | Desktop notify |
| `groxbot.localComputer` | ask / always / never |
| `groxbot.autoReview` / `groxbot.autoReviewRules` | Post-turn review |
| `groxbot.hwAccel` | Desktop |
| `groxbot.onboarded` | First-run flag |
| `sessionStorage` `groxbot.invite` | Invite id across the gate |

Do not put email, tokens, or file bodies in localStorage. Do not put the roster or transcripts there — that is Query + IDB.

## Sign-out

`clearThreadStore()` (then `queryClient.clear()`):

1. Drop office message queries
2. Remove `groxbot.workspace`
3. `persister.removeClient()` (IndexedDB blob)
4. Empty thread-meta, bots, apps, plugins, mcp collections

## Adding a persisted list

1. One oRPC `queryKey`. If it is a roster, also a query collection on that key.
2. `gcTime` ≥ `OFFICE_MESSAGES_GC_TIME`.
3. Add the key to `CATALOG_KEYS`, or a matcher like `isComputerListQueryKey`.
4. Cover it in `office-persist.test.ts`.
5. Bump `OFFICE_CACHE_BUSTER` only when old dehydrated data would be wrong.

If the UI is a **label that must not flash** and the query must not be persisted (auth/`me`), use a small localStorage hint like `groxbot.workspace`. Do not persist the whole `me` object to make the label instant.

## Do not

- Persist `me`, session, secrets, or downloads.
- Hand-write an IndexedDB object store next to `persistQueryClient`.
- Treat TanStack DB as durable storage. Only query collections ride IDB, and only because they share QueryClient keys.
- Use persist as the office transcript seed. Reload seed is a snapshot; the actor still owns the log.
- Raise file-body `gcTime` into the 7-day persist window without adding them to the dehydrate whitelist on purpose.
- Copy this persist onto Expo until mobile has a real IDB story.
