# Groxbot

Source-available **Grok Bot** — Grok, then grox. Teammates with a real computer. Composio for Gmail/Slack/GitHub. Shared workspace context and skills. Bring your own model keys. Self-host for your team is free; hosted Groxbot for others is the cloud business.

Packages live under `@groxbot/*`.

Early scaffold: contracts, Neon Postgres (team data), one Think Durable Object per bot, Cloudflare Workers for landing + office + API. Live apps (docs / slides / sheets) next to chat. Self-host later.

## Stack (locked)

- TypeScript, pnpm, Hono, React, Vite, TanStack Router
- **oRPC** — one contract for web, desktop, and mobile
- Postgres + Drizzle — workspaces, threads, skills (Neon on Cloudflare)
- **One queue per bot** — Durable Object `BotActor` (Think)
- Hosted brains: Think on that actor (tests: scripted)
- **Routines** — Postgres cron metadata; the actor enqueues `routine.wakeup`
- Better Auth (magic-link email, Google, GitHub)
- **Cloudflare first:** Workers (landing, web, API) + Neon. Local = `wrangler dev` + Vite
- **Apps** — docs / slides / sheets as `AppRuntime` Durable Objects
- Plugins: Composio (optional)
- Plugins: Composio (optional)
- UI: **web first** (Grok Bot-simple) — [docs/grok-bot-ui.md](./docs/grok-bot-ui.md). Desktop = Electron around web. Mobile = Expo later.

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Requirements

- Node.js 22+
- pnpm 9
- A Neon database (same project for local wrangler and `pnpm db:migrate`)

## Run locally

```bash
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Put the same Neon DATABASE_URL (and secrets) in both files.
pnpm install
pnpm db:migrate
pnpm dev
```

`pnpm dev` is **wrangler** (API Worker + Durable Objects on :3100) and **Vite** (office on :5173, which proxies `/api` `/rpc` `/health`).

- API: http://127.0.0.1:3100/health
- oRPC: http://127.0.0.1:3100/rpc
- Web: http://127.0.0.1:5173 — `/` welcome, `/login`, `/onboarding`, `/{botId}` office
- Landing: http://127.0.0.1:5174 — marketing (`pnpm dev:landing`)

Public LLM / agent discovery (also on https://groxbot.com):

- `/llms.txt` (and `/llm.txt` → 301)
- `/llms.html`, `/llms-full.txt`, `/index.md`
- `/ai.txt`, `/ai.json`, `/identity.json`, `/brand.txt`, `/faq-ai.txt`, `/developer-ai.txt`, `/robots-ai.txt`
- `/robots.txt`, `/sitemap.xml`
- `/mcp` Streamable HTTP + `/.well-known/mcp.json`


Google / GitHub need client IDs in `.env`. Use **127.0.0.1**, not localhost:

- Google redirect: `http://127.0.0.1:5173/api/auth/callback/google`
- GitHub callback: `http://127.0.0.1:5173/api/auth/callback/github`

Email sign-in sends a magic link through **Cloudflare Email Sending** (REST). Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, and `EMAIL_FROM`. Without those, local (and hosted until those secrets exist) prints the link / uses `mail: log`.

Office chats on the Worker use **gateway** if you pasted model keys, otherwise **scripted**. `AGENT_RUNTIME=flue` on the Worker means that mapping until Flue’s Cloudflare target exists. Paste provider keys and pick a default model in the office (**Settings → Models**). Tests stay on `scripted`.

**Cloudflare AI Gateway** is in that same Models tab (account id, API token, gateway id). See [Cloudflare’s Pi guide](https://developers.cloudflare.com/ai-gateway/integrations/coding-agents/pi/).

Landing (marketing site, TanStack Start):

```bash
pnpm dev:landing
```

Deploy hosted staging to Cloudflare Workers. Config lives in each app’s `wrangler.jsonc` — no account IDs or secrets. Attach `groxbot.com` / `app.groxbot.com` / `api.groxbot.com` in the dashboard when the domain is ready.

```bash
pnpm --filter @groxbot/api exec wrangler login
pnpm deploy:landing   # https://groxbot-landing.qalam.workers.dev
pnpm deploy:web       # https://groxbot-web.qalam.workers.dev
pnpm deploy:api       # https://groxbot-api.qalam.workers.dev/health
```

API Worker secrets (`wrangler secret put` in `apps/api`): `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`. Wakeup is a Durable Object per `botId`. Brains are gateway-if-keys / scripted. `SANDBOX_PROVIDER=fake` until Computer/Sandbox factories are wired.

Advanced, off by default: a bot can let **Hermes** or **OpenClaw** connect outbound (`pnpm guest -- --url http://127.0.0.1:3101 --token … --kind hermes`). Enable it under Profile → Advanced. Default teammates still use the scripted/Pi runtime.

Desktop (same web UI in a window):

```bash
pnpm dev:desktop
```

That loads local Vite + wrangler. A **packaged** desktop build opens **https://app.groxbot.com**, which talks to **https://api.groxbot.com**. The marketing site is **https://groxbot.com**.

OAuth callbacks (hosted staging until groxbot.com is attached):

- `https://groxbot-api.qalam.workers.dev/api/auth/callback/google`
- `https://groxbot-api.qalam.workers.dev/api/auth/callback/github`

Mobile (Expo stub, later):

```bash
pnpm dev:mobile
```

On a device, set `EXPO_PUBLIC_API_URL` to this machine’s LAN address.

## Layout

```
apps/web desktop mobile landing guest api worker
packages/contracts rpc adapter-kit core db auth adapters mascot seo
infra/compose
docs/
```

## License

Fair-code (Apache 2.0 plus conditions). See [LICENSE](./LICENSE).

Self-host for your own organization is free. You may not run a hosted Groxbot for third parties without a commercial license — that is groxbot.com. Not OSI-open, not MIT.
