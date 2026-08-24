# AGENTS.md

- Public repo: never commit secrets, `.env`, `.dev.vars`, or real user data.
- Keep domain logic in `packages/*`. Apps wire adapters. Product API is oRPC (`@groxbot/contracts` + `@groxbot/rpc`).
- **Cloudflare first. Actor model first.** One Durable Object per `botId`: `BotActor` extends Think. Instance name is `botId`, never `threadId`. v1 is one home-office thread and **one Think Session** on that actor (DO SQLite: compaction, tree, context). Do not add `SessionManager` yet. Do not use a custom `SessionProvider` or Cloudflare Session as the office catalog. One Durable Object per live app (`AppRuntime`, name = `appId`).
- Each bot **has a computer** — Think `this.workspace` on `BotActor`. Sell it. Do not add a `computers` table, shared desk, takeover pane, `computer.sleep`, or a Computer Durable Object. The office pane is this bot’s screen.
- Kernel: office, oRPC, Postgres (Neon), `botId` as the actor key, app cards. The HTTP isolate addresses DOs (`getAgentByName` / stub). Do not add `WakeupDriver` or `MemoryAppStore` as stand-ins for queues, alarms, or app document state.
- Shared team data lives in Postgres, not in the DO. Chat/threads stay in Postgres (oRPC office). Think Session (DO SQLite) is the actor’s working tree — compaction, not the sidebar transcript.
- Hosted brain: Think `chat()` on `BotActor`. Tests use `ScriptedAgentRuntime`. Do not treat Flue or Pi as the product loop.
- Live apps: workspace-owned docs / slides / sheets. Talk → chat card → Open. `AppRuntime` supervisor DO; `export class Gadget` from stamped `server.js` is a Dynamic Worker Facet; iframe Cap’n Web; parent holds `wss://…/apps/:id/rpc`. Listing (`apps.list`) is derived from chat cards. No Postgres apps catalog. No file manager in product UI.
- Auth, secrets, and host commands are security-sensitive.
- Tests stay offline: `ScriptedAgentRuntime` — no live OpenRouter / Computer / Sandbox / E2B. Actor tests enqueue onto a function that runs `createWakeHandlers`.
- Guest runtimes (Hermes/OpenClaw) are opt-in per bot, off by default.
- v1 surface is **web** (Vite + TanStack Router). Desktop is Electron around web. Mobile is Expo later. All three call **oRPC** via `@groxbot/rpc`.
- See `docs/grok-bot-ui.md` and `docs/computers.md`.
- Self-host / Flue / Pi are not v1.
