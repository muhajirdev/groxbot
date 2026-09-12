# Hosted D1 cutover

Shared-team SQL (auth, workspaces, roster, rooms, billing, MCP, poke threads) lives in **one Cloudflare D1 database** per deployment. Office transcripts stay on the home `RoomActor` (DO SQLite). Knowledge stays on R2.

This is a freeze-and-copy. There is no dual-write.

## Local / empty database

```bash
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Fill BETTER_AUTH_SECRET and ENCRYPTION_KEY. Do not set DATABASE_URL.
pnpm install
pnpm db:generate          # only after schema changes
pnpm db:migrate            # wrangler d1 migrations apply groxbot --local
pnpm dev
```

- API: http://127.0.0.1:3100/health — `database` should be `"ok"`.
- Web: http://127.0.0.1:5173
- Magic-link / email OTP writes Better Auth `verification` (plus `user`, `session`, `account`). `0000` creates them; `0001_restore_better_auth_tables.sql` is `CREATE TABLE IF NOT EXISTS` so a catalog that skipped empty auth tables still gets them after `pnpm db:migrate`.

Create a hosted D1 once, then put the real id in `apps/api/wrangler.jsonc`:

```bash
pnpm --filter @groxbot/api exec wrangler d1 create groxbot
pnpm db:migrate:remote
```

## Node self-host

Same sqlite schema on a file:

```bash
export DATABASE_PATH=data/groxbot.sqlite
pnpm db:migrate:file
pnpm --filter @groxbot/api dev:node
```

## Hosted freeze-and-copy

1. Pause writes (maintenance / drain Worker).
2. Dump Neon as JSON or CSV (one table at a time). Coerce:
   - `timestamptz` → integer milliseconds (`sqliteTimestamp` in `@groxbot/db`)
   - `jsonb` (`messages.blocks`, `events.payload`) → JSON text (`sqliteJson`)
   - booleans → `0` / `1`
3. Keep primary keys (`user.id`, `bots.id`, `rooms.id`, `bots.homeRoomId`).
4. Insert in batches under **100 bound parameters** (`splitBindRows` in `@groxbot/db`). D1 import files cap at 5 GB.
5. `pnpm db:migrate:remote` if the D1 schema is empty, then load rows.
6. Deploy the Worker with the `DB` binding and **no** `DATABASE_URL`. Smoke: sign-in, hire, roster, rooms.list, poke.
7. `wrangler secret delete DATABASE_URL` if it is still set.
8. Confirm Time Travel (Paid, 30 days) is the new PITR.

Do not point CI at production Neon. Fixture transforms live in `packages/db/src/cutover.test.ts`.
