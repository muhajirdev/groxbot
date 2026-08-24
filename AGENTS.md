# AGENTS.md

- Public repo: never commit secrets, `.env`, `.dev.vars`, or real user data.
- Keep domain logic in `packages/*`. Apps wire adapters. Product API is oRPC (`@groxbot/contracts` + `@groxbot/rpc`).
- **Cloudflare first.** The product API is the Worker (`apps/api/src/worker.ts`). One queue per bot: Durable Object `BotActor` (`WAKEUP_KIND=durable-object`). Shared team data lives in Postgres (Neon), not in the DO. Local loop is `wrangler dev` + Vite, not Node.
- The Pi/executor must not import `fs`, `dockerode`, or Cloudflare bindings. The API Worker uses `@groxbot/adapters/edge` (scripted / gateway). Flue Node (`@flue/runtime/node`) and `apps/worker` are a later self-host path — do not add features that only work there.
- Auth, secrets, sandbox, and host commands are security-sensitive.
- Tests stay offline: `AGENT_RUNTIME=scripted` (or `flue-echo` for the Pi harness), `SANDBOX_PROVIDER=fake`, in-process wakeup — no live OpenRouter / Cloudflare Computer / Cloudflare Sandbox / E2B.
- Hosted teammate loop: gateway if model keys exist, else scripted. `AGENT_RUNTIME=flue` on the Worker maps to that (Flue Cloudflare target is later). Hands stay `useSandbox(factory)` keyed by `computerId`. One `Teammate` function; hires are `botId`, not new agent modules.
- Guest runtimes (Hermes/OpenClaw) are opt-in per bot, off by default. They dial out to Groxbot; tests use a fake guest, not live Hermes/OpenClaw.
- v1 surface is **web** (Vite + TanStack Router). Desktop is Electron around web. Mobile is Expo later. All three call **oRPC** via `@groxbot/rpc`.
- See `docs/grok-bot-ui.md` and `docs/computers.md`.
- Workspace apps (docs / slides / sheets) belong to the workspace, not a computer or thread. Factory templates are plain `client.js` / `server.js` stamped into the App Durable Object; that copy plus document state are the source of truth. Do not add `.gadget` archives, blueprint packs, or a gadget file manager. Docs/slides/sheets UI is derived from Cloudflare OS (Apache 2.0); the iframe host implements their RPC against `gadget.load`/`save`. Do not expose computer, thread, gadget, blueprint, or source in the product UI. Do not add Cap’n Web or Yjs for apps.
- Desktop sandbox is owner opt-in on a trusted machine. Never enable it for hosted Computer / Sandbox / E2B.
