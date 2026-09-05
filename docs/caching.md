# Client cache (web)

Web’s “instant office” is **one TanStack QueryClient**. TanStack DB collections are live rows over that client. IndexedDB is a **whitelist dehydrate** of the same client. localStorage is only for **sync chrome** Query persist does not cover.

Desktop is Electron around this web app, so it gets the same cache. Mobile has a QueryClient and **no** IndexedDB persist.

## Instant paint

This is the product rule, not an office-only trick. **Chrome never waits on the network.** The shell, dialog, or pane opens on the last-known view. A fetch may run in the background and swap numbers in place. The first visit in a browser may show a quiet line in the *body* (“Loading…”). It must not freeze the chrome, block the open animation, or mount a thousand DOM nodes before first paint.

How that is built, in order:

1. **Keep the shell mounted.** Settings and Plugins stay in the tree with `open`. Open/close is visibility + CSS, not a mount that then waits on `useQuery`.
2. **Paint from Query.** `useQuery` returns cached `data` immediately. `enabled: open` is fine — cached rows still show. Do not gate the whole UI on `isPending`.
3. **After the first success, persist what is safe.** IndexedDB (`groxbot-query-cache`) is the hot cache across reloads. Next open is a restore, not GitHub, not a cold oRPC.
4. **Incrementally fill huge lists.** Virtualize. Lazy images. Do not bundle a catalog into the web app so the first JS parse “feels cached.”
5. **Do not steal boot.** Prefetch on first *open* (or idle after the office is up). Do not `prefetchQuery` a fat catalog during persist restore.

Canonical feel: **Settings**. Cmd+, opens at once. General is `me` already on the client plus localStorage prefs. Updates is the build stamp. Usage & Billing / Models reuse `models.get` — after one fetch in the session, tab switches are cache hits. Same pattern as the roster, a thread reopen, Plugins after the first catalog load.

| Surface | Instant from | Then |
|---|---|---|
| Settings → General | `me` in memory; theme / review / local-computer prefs in localStorage | Members list may fill |
| Settings → Updates | `BUILD_REVISION` | Nothing |
| Settings → Usage & Billing, Models | `models.get` Query cache (same session) | Refetch when stale. Not in IndexedDB — payload includes key status |
| Roster, rooms, workspace name, apps, connectors, knowledge tree, computer trees | IndexedDB restore before first paint | Background refetch |
| Knowledge / computer text preview | Query + IndexedDB after idle prefetch, Cmd+K, or first open (text, 64k cap) | Background refetch when stale. Not images, PDFs, or `*.download` |
| Office / room transcripts | IndexedDB bag + keep-alive | Cap’n Web snapshot |
| Plugins catalog | IndexedDB after first open | GitHub JSON on a cold miss; virtualized grid |
| Workspace switcher label | `groxbot.workspace` localStorage hint | Live `me` (not persisted) |
| Workspace switch | Per-workspace catalog snapshot in Query + IndexedDB; last desk in `groxbot.lastRooms` | Background refetch. `workspaces.activate` does not block paint |

A loading spinner that replaces the dialog, a blank settings tab, or a 5s GitHub wait before Plugins “opens” is a bug against this rule.

Source of truth is never the browser:

| Data | Truth |
|---|---|
| Team, bots, members, models | Postgres |
| Office chat | Pi Session (`sessions` / `entries`) on the home `RoomActor`, streamed over Cap’n Web |
| Group room chat | DO SQLite `room_chat` on the group `RoomActor`, streamed over Cap’n Web |
| This bot’s files | `@cloudflare/computer` `Workspace` on the home `RoomActor` |
| Office knowledge | R2 `{workspaceId}/…` |

R2 `_search/index.json` and `_links/index.json` are **Worker snapshots**, not this cache. See [knowledge-search.md](./knowledge-search.md).

## Boot

`apps/web/src/main.tsx` imports `./styles.css` then `./lib/office-persist` **before** `createRoot`. Persist `await`s `persistQueryClient` restore, then `hydrateBotPreviews()`. First React paint already has the restored whitelist.

Session is **not** in that blob. `office-persist` starts `getSession` (then `me`) **while** IndexedDB restore runs so boot is one wait, not persist-then-session. Root `beforeLoad` joins that in-flight query. `workspaces.list` is warmed only after restore so hydrate wins over a blank fetch.

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
localStorage / sessionStorage    prefs + workspace name + last desk + invite
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
| Per-workspace catalog snapshot | `apps/web/src/lib/workspace-catalog.ts` |
| Theme / notify / review prefs | `apps/web/src/lib/theme.ts`, `prefs.ts` |

## QueryClient defaults

From `orpc.ts`: `staleTime` 30s, `gcTime` 30m, `retry: false`, `refetchOnWindowFocus: false`.

Auth session (`["auth", "session"]` in `session.ts`) is **memory only**, `staleTime` 5m. Persist explicitly skips it.

Catalog collections set `gcTime` to `OFFICE_MESSAGES_GC_TIME` (7 days) so rows outlive the persist `maxAge`. `knowledge.read` / `computer.read` text previews use that same window so persist can keep them. `me` and models stay memory-only at 30m.

## What IndexedDB keeps

`shouldDehydrateOfficeQuery` — **success only**. Key `groxbot-query-cache`. `maxAge` = 7 days. `OFFICE_CACHE_BUSTER` (`"6"` today): bump this when the dehydrated shape is incompatible; it wipes every browser cache.

| Query | Why |
|---|---|
| `["office-messages", botId]` | Last office transcript per bot. Seeded into `useOfficeChat`. Written with `setOfficeMessages`, not a `queryFn`. |
| `["room-messages", roomId]` | Last board log per room. Seeded into `useRoomChat`. Do not key this by `botId`. |
| `bots.list` | Roster. Query collection. Last line overlaid from the office transcript cache so a refetch that sends `""` does not blank the sidebar. |
| `rooms.list` | Group room catalog (not someone’s `homeRoomId`). Query collection. Last line overlaid from the room transcript cache. Home rooms are not in this list — do not refetch it just because the URL is a home `roomId`. |
| `workspaces.list` | Workspace picker + `/$workspaceSlug` layout. `gcTime` 7 days. Cookie session / `me` stay memory-only; this list is names and slugs. |
| `["workspace-catalog", workspaceId]` | Last roster / rooms / sections / apps / connectors / knowledge tree for that office. Switch paints this onto the live `bots.list` keys. |
| `sections.list` | Sidebar groups. Query collection. |
| `apps.list` | Live app cards. Query collection. |
| `plugins.list` / `mcp.list` | Connectors. Query collections. Refetch on window focus. |
| `["plugin-catalog"]` | Slim Composio toolkit cards for the Plugins modal. First open fetches GitHub; after that, IndexedDB is the hot cache. Do not bundle the catalog into the web app, and do not prefetch it on boot. |
| `knowledge.list` | Office tree. `useQuery` only (no collection). |
| `knowledge.read` / `computer.read` | Text preview bodies only (`encoding: "text"`, cap 64k). Idle prefetch after paint (32, two at a time, skip cache hits). Cmd+K also prefetches the highlighted file. Matcher strips `botId`/`path`. |
| `computer.list` `{ botId }` | Each teammate’s file tree. Matcher strips `botId`/`path` so every bot’s list shares the procedure. **Not** `computer.download`. |

Writes into a query collection (`writeUpsert` / `writeUpdate` / `writeDelete`) go through QueryClient, then into IDB on the next persist throttle. `patchBot({ lastPreview })` is that path.

## What IndexedDB must not keep

| Query | Why |
|---|---|
| `["auth", "session"]` | Cookie session. Routing. |
| `orpc.me` | Email, `needsModel`, `needsWorkspace`. Stale `me` would mis-route. |
| `knowledge.graph` | Derived; cheap GET. |
| `knowledge.download` / `computer.download` | Binary / base64 blobs. Images and PDFs refetch with 60s stale. |
| `routines.list` | Computer pane. Memory Query is enough for a session; not the office shell. |
| `models.get`, `workspaces.members` | Settings. Instant from Query after first fetch; do not put key status or member emails in IndexedDB. |

Tests: `apps/web/src/lib/office-persist.test.ts`. Node has no IndexedDB (`officeCacheEnabled() === false`).

## TanStack DB

**Query collections** (`queryCollectionOptions`) bind a list RPC to rows. UI uses `useLiveQuery`. Route loaders call `loadOfficeRoomCatalog` / `botsCollection.preload()` — after persist restore that is a cache hit. A home `roomId` is on the roster, not `rooms.list`; do not refetch rooms just because the collection does not have that id.

Switching offices is a **slice swap**, not a cache wipe. `prepareWorkspaceSwitch` snapshots the live catalogs under `["workspace-catalog", fromId]`, restores `toId` onto the live keys, then navigates. Transcripts stay (`office-messages` / `room-messages` are keyed by room). Knowledge file bodies are unscoped paths — they are dropped on switch so the other office cannot paint the wrong note. `clearThreadStore` is sign-out only.

Optimistic hire / plugin / MCP patches use `collection.utils.write*`. If sync has not started, those helpers throw; callers catch.

**`threadMetaCollection`** is `localOnlyCollectionOptions`. Cursor, working, error, opening. RAM only. Lost on reload. Do not persist it.

Do not add a collection that is the office catalog. The catalog is `bots.list` plus the office transcript bag. Do not add `SessionManager` or a Cloudflare Session list.

## Office keep-alive

`office-keepalive.ts` is **not** a data cache. Chat keeps up to 8 office trees mounted so switching a teammate is a visibility toggle, not a remount. First visit is still cold unless the transcript bag already has a row.

After paint, `scheduleThreadPrefetch` snapshots every other live home and group room in the background (Cap’n Web `snapshot()`, two at a time) and writes `office-messages` / `room-messages`. Skip the open room and any id already in the bag (IndexedDB restore counts). Do not await this in a loader.

Same idle window: `scheduleKnowledgeFilePrefetch` reads the office tree and warms up to 32 text knowledge files (`knowledge.read`), two at a time. Skip binaries, images, PDFs, and anything already in Query (IndexedDB restore counts). Prefer the open library path, then `SKILL.md`, then other markdown. Do not await this in a loader.

## Sync chrome (localStorage)

Query persist is async-to-disk and **awaited** before paint, so catalog and threads do not flash. Anything **not** on the whitelist still comes from the network on first `useQuery`.

`orpc.me` is not persisted (see above). The top-left office name would otherwise render `"Workspace"` until `me` returns. That name is a tiny localStorage hint:

- Key `groxbot.workspace` → `{ id, name }`
- Key `groxbot.lastRooms` → `{ [workspaceId]: roomId }` so a switch reopens the last desk
- Read synchronously in `WorkspaceSwitcher`
- Write when live `me` (or a rename / create / join) has both id and name
- Ignore the cached name if the live `workspaceId` differs
- Cleared on sign-out with the rest of the client store

Other keys (not Query):

| Key | |
|---|---|
| `groxbot.theme` | Appearance |
| `groxbot.workspace` | Current office name hint |
| `groxbot.lastRooms` | Last `roomId` per office |
| `groxbot.sideWidth` | Roster column. Drag the list edge. |
| `groxbot.paneWidth` | Computer / settings / knowledge peek column. Drag the pane edge. |
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
2. Remove `groxbot.workspace` and `groxbot.lastRooms`
3. `persister.removeClient()` (IndexedDB blob)
4. Empty thread-meta, bots, apps, plugins, mcp collections

## Adding a persisted list

Only if the surface must be instant **after a reload**, and the payload has no secrets.

1. One oRPC `queryKey`. If it is a roster, also a query collection on that key.
2. `gcTime` ≥ `OFFICE_MESSAGES_GC_TIME`.
3. Add the key to `CATALOG_KEYS`, or a matcher like `isComputerListQueryKey`.
4. Cover it in `office-persist.test.ts`.
5. Bump `OFFICE_CACHE_BUSTER` only when old dehydrated data would be wrong.
6. Chrome still opens if the cache is cold: `enabled` on first open, quiet body state, no bundled JSON.

If the UI is a **label that must not flash** and the query must not be persisted (auth/`me`), use a small localStorage hint like `groxbot.workspace`. Do not persist the whole `me` object to make the label instant.


## Do not

- Persist `me`, session, secrets, or downloads (images/PDFs stay Query-only).
- Hand-write an IndexedDB object store next to `persistQueryClient`.
- Treat TanStack DB as durable storage. Only query collections ride IDB, and only because they share QueryClient keys.
- Use persist as the office transcript seed. Reload seed is a snapshot; the actor still owns the log.
- Wipe IndexedDB or `clearThreadStore` on workspace switch. Snapshot the live slice; restore the other office; refetch in the background.
- Copy this persist onto Expo until mobile has a real IDB story.
