# AGENTS.md

- Public repo: never commit secrets, `.env`, `.dev.vars`, or real user data.
- Postgres schema: change `packages/db/src/schema`, then `pnpm db:generate`, then `pnpm db:migrate`. Never hand-write `packages/db/drizzle/*.sql` or skip snapshots. If generate asks create vs rename, stop — snapshots are out of date.
- Keep domain logic in `packages/*`. Apps wire adapters. Product API is oRPC (`@groxbot/contracts` + `@groxbot/rpc`).
- **Cloudflare first. Actor model first.** One Durable Object per `botId`: `BotActor` extends Think. Instance name is `botId`, never `threadId` / `roomId`. v1 is one home-office thread and **one Think Session** on that actor (DO SQLite: compaction, tree, context). A later group room is a **separate** Durable Object (`RoomActor`, name = `roomId`) that does **not** extend Think — coordinator only (log, members, floor, websockets). Do not add `SessionManager` yet. Do not use a custom `SessionProvider` or Cloudflare Session as the office catalog. One Durable Object per live app (`AppRuntime`, name = `appId`). See [docs/rooms-plan.md](./docs/rooms-plan.md).
- Each bot **has a computer** — Think `this.workspace` on `BotActor`. Sell it. Do not add a `computers` table, shared desk, takeover pane, `computer.sleep`, or a Computer Durable Object. The office pane is this bot’s screen.
- Office routines live on `BotActor` via Agents `this.schedule` / `listSchedules` / `cancelSchedule` (`cf_agents_schedules`). The callback `runScheduledRoutine` starts a Think turn with `submitMessages`. Pause parks the payload in DO storage (Agents has no pause). No `routines` table, not Think `getScheduledTasks()`, not Worker Cron Triggers. The agent uses a Code Mode `routines` connector inside `execute` (`routines.list` / `create` / `pause` / `resume` / `remove`).
- Office knowledge is one R2 prefix per workspace (`KNOWLEDGE` binding, `{workspaceId}/…`). The tree is free — no Skills/Notes/Sources buckets. A `SKILL.md` anywhere is a playbook; Think `getSkills()` prefers those, then computer drafts. No `skills` table, no marketplace, no Artifacts, no bucket per workspace. Always join `actor.workspaceId`; reject `..`. Markdown links are office-root paths; a disposable `_links/index.json` snapshot (hidden) is derived on write — not a catalog. One-file backlinks scan that snapshot; the graph view is one GET, inverted in the client. Search uses a disposable `_search/index.json` (fielded BM25, hidden, cap 800 files). The agent uses a Code Mode `knowledge` connector inside `execute` (`knowledge.search` / `read` / `write`) — not top-level chat tools, not this computer. After enough tool work, `BotActor` may run a post-turn review on the same Think session (`saveMessages`, hidden `office-review` user). If it files something, it mentions the path in the thread; Skip stays hidden. Knowledge UI is a library modal (tree + preview), not a second computer explorer.
- Kernel: office, oRPC, Postgres (Neon), `botId` as the actor key, app cards. The HTTP isolate addresses DOs (`getAgentByName` / stub). Do not add `WakeupDriver` or `MemoryAppStore` as stand-ins for queues, alarms, or app document state.
- Shared team data lives in Postgres, not in the DO. Office chat is Think on `BotActor` (DO SQLite). Postgres threads stay for poke / guest continue — not the office transcript.
- Hosted brain: Think `chat()` on `BotActor` for v1 office (computer + Session). Owned-message turns (poke / guest / REST gateway) use Pi `runAgentLoopContinue` on that same person — not on a room. Tests use `ScriptedAgentRuntime`.
- Live apps: workspace-owned docs / slides / sheets. Talk → chat card → Open. `AppRuntime` supervisor DO; `export class Gadget` from stamped `server.js` is a Dynamic Worker Facet; iframe Cap’n Web; parent holds `wss://…/apps/:id/rpc`. Listing (`apps.list`) is derived from chat cards. No Postgres apps catalog. No file manager in product UI.
- Auth, secrets, and host commands are security-sensitive.
- Tests stay offline: `ScriptedAgentRuntime` — no live OpenRouter / Cloudflare AI Gateway / Computer / Sandbox / E2B. Actor tests enqueue onto a function that runs `createWakeHandlers`.
- Hosted models: Worker `AI` binding through Cloudflare AI Gateway. Workspace BYOK wins. Count hosted usage per workspace (`model_usage`).
- Auth email: Worker `EMAIL` binding (`send_email`). `EMAIL_FROM` is the from address.
- Guest runtimes (Hermes/OpenClaw) are opt-in per bot, off by default.
- v1 surface is **web** (Vite + TanStack Router). Desktop is Electron around web. Mobile is Expo later. All three call **oRPC** via `@groxbot/rpc`.
- See `docs/grok-bot-ui.md`, `docs/computers.md`, `docs/knowledge-search.md`, `docs/caching.md`, and `docs/rooms-plan.md`.

## Cursor Cloud specific instructions

Desktop / `computerUse` / screen recordings are slow. Treat them as opt-in, not the default demo.

- Prove work with automated tests and logs: `pnpm test`, `pnpm check`, targeted `vitest run`, curl against local services. Put that evidence in `/opt/cursor/artifacts` (test output, logs, one screenshot if it actually helps).
- Do **not** start `computerUse`, the desktop, or `RecordScreen` unless the user explicitly asks for a visual walkthrough or a click-through of the running UI.
- Do **not** record walkthrough videos by default. Skip the video-artifact flow. A single screenshot is enough when a UI pixel must be shown; tests/logs are enough otherwise.
- UI, layout, routing, and client-state changes still need verification — use vitest, existing web tests, and curl. Not a headed desktop session.
- If computer use is skipped or unavailable, that is not a blocker. Ship with test/log evidence.
