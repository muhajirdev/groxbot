# Contributing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for locked decisions (one queue per bot, Postgres, oRPC, web-first clients, Cloudflare hosted, computer built into the bot).

Contributions are under the [Groxbot License](./LICENSE): self-host for your organization is free; the authors may use contributions in groxbot.com and may tighten or relax the license.

```bash
pnpm install
pnpm test
pnpm check
```

`pnpm dev` is API + worker + **web**. Landing: `pnpm dev:landing`. Desktop: `pnpm dev:desktop`. Mobile: `pnpm dev:mobile`.

CI should run `pnpm test` and `pnpm check`. Default tests stay offline (`ScriptedAgentRuntime`). Product office brain is Pi on the home `RoomActor` (Cap’n Web `/rooms/:roomId/rpc`); owned-message REST turns use the same loop; hosted models still go through the Worker `AI` binding or gateway keys.
