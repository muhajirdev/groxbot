# AGENTS.md

- Public repo: never commit secrets, `.env`, `.dev.vars`, or real user data.
- Postgres schema: change `packages/db/src/schema`, then `pnpm db:generate`, then `pnpm db:migrate`. Never hand-write `packages/db/drizzle/*.sql` or skip snapshots. If generate asks create vs rename, stop — snapshots are out of date.
- Keep domain logic in `packages/*`. Apps wire adapters. Product API is oRPC (`@groxbot/contracts` + `@groxbot/rpc`).
- **Cloudflare first. Actor model first.** One Durable Object per `botId`: `BotActor` extends Think. Instance name is `botId`, never `threadId`. v1 is one home-office thread and **one Think Session** on that actor (DO SQLite: compaction, tree, context). Do not add `SessionManager` yet. Do not use a custom `SessionProvider` or Cloudflare Session as the office catalog. One Durable Object per live app (`AppRuntime`, name = `appId`).
- Each bot **has a computer** — Think `this.workspace` on `BotActor`. Sell it. Do not add a `computers` table, shared desk, takeover pane, `computer.sleep`, or a Computer Durable Object. The office pane is this bot’s screen.
- Office knowledge is one R2 prefix per workspace (`KNOWLEDGE` binding, `{workspaceId}/…`). The tree is free — no Skills/Notes/Sources buckets. A `SKILL.md` anywhere is a playbook; Think `getSkills()` prefers those, then computer drafts. No `skills` table, no marketplace, no Artifacts, no bucket per workspace. Always join `actor.workspaceId`; reject `..`. Markdown links are office-root paths; a disposable `_links/index.json` snapshot (hidden) is derived on write — not a catalog. One-file backlinks scan that snapshot; the graph view is one GET, inverted in the client. Search uses a disposable `_search/index.json` (fielded BM25, hidden, cap 800 files). The agent uses a Code Mode `knowledge` connector inside `execute` (`knowledge.search` / `read` / `write`) — not top-level chat tools, not this computer. After enough tool work, `BotActor` may run a post-turn review on the same Think session (`saveMessages`, hidden `office-review` user). If it files something, it mentions the path in the thread; Skip stays hidden. Knowledge UI is a library modal (tree + preview), not a second computer explorer.
- Kernel: office, oRPC, Postgres (Neon), `botId` as the actor key, app cards. The HTTP isolate addresses DOs (`getAgentByName` / stub). Do not add `WakeupDriver` or `MemoryAppStore` as stand-ins for queues, alarms, or app document state.
- Shared team data lives in Postgres, not in the DO. Office chat is Think on `BotActor` (DO SQLite). Postgres threads stay for poke / guest continue — not the office transcript.
- Hosted brain: Think `chat()` on `BotActor`. Tests use `ScriptedAgentRuntime`. Do not treat Flue or Pi as the product loop.
- Live apps: workspace-owned docs / slides / sheets. Talk → chat card → Open. `AppRuntime` supervisor DO; `export class Gadget` from stamped `server.js` is a Dynamic Worker Facet; iframe Cap’n Web; parent holds `wss://…/apps/:id/rpc`. Listing (`apps.list`) is derived from chat cards. No Postgres apps catalog. No file manager in product UI.
- Auth, secrets, and host commands are security-sensitive.
- Tests stay offline: `ScriptedAgentRuntime` — no live OpenRouter / Cloudflare AI Gateway / Computer / Sandbox / E2B. Actor tests enqueue onto a function that runs `createWakeHandlers`.
- Hosted models: Worker `AI` binding through Cloudflare AI Gateway. Workspace BYOK wins. Count hosted usage per workspace (`model_usage`).
- Auth email: Worker `EMAIL` binding (`send_email`). `EMAIL_FROM` is the from address.
- Guest runtimes (Hermes/OpenClaw) are opt-in per bot, off by default.
- v1 surface is **web** (Vite + TanStack Router). Desktop is Electron around web. Mobile is Expo later. All three call **oRPC** via `@groxbot/rpc`.
- See `docs/grok-bot-ui.md`, `docs/computers.md`, and `docs/knowledge-search.md`.
- Self-host / Flue / Pi are not v1.
