# Polar integration (research)

**Recommendation:** use [Polar](https://polar.sh) as the Merchant of Record for **hosted** groxbot.com. Do not put Polar in v1. Self-host stays free, with Polar unset.

This is research, not a locked architecture decision. Product API, auth, and computers stay as they are.

Polar docs index: [polar.sh/docs/llms.txt](https://polar.sh/docs/llms.txt). Primary pages used below: [Better Auth adapter](https://polar.sh/docs/integrate/sdk/adapters/better-auth), [Hono adapter](https://polar.sh/docs/integrate/sdk/adapters/hono), [Customer State](https://polar.sh/docs/integrate/customer-state), [usage billing](https://polar.sh/docs/features/usage-based-billing/introduction), [seat-based pricing](https://polar.sh/docs/features/seat-based-pricing), [feature-flag benefits](https://polar.sh/docs/features/benefits/feature-flags), [sandbox](https://polar.sh/docs/integrate/sandbox), [fees](https://polar.sh/docs/merchant-of-record/fees).

## Why Polar (for hosted cloud)

Groxbot is fair-code (Apache 2.0 plus no competing hosted cloud), workspace-scoped, BYOK by default, and will eventually charge for **hosted** compute (Cloudflare Computer workspace on each bot, Cloudflare AI Gateway), not for the source. Self-host for your own organization stays free; offering Groxbot as a cloud to third parties needs a commercial license.

| Need | Polar | Stripe-as-PSP |
| --- | --- | --- |
| Global VAT/GST/sales tax | Polar is the seller (MoR) | We are the seller; tax is ours |
| Checkout + portal | Hosted, adapters for Hono and Better Auth | Build more ourselves |
| Workspace / team billing | `referenceId`, seat products, team customers | Native, more flexible |
| Usage (computer minutes, hosted tokens) | Event ingest + meters on subscriptions | Mature; more knobs |
| OSS / GitHub-shaped extras | License keys, private repo, Discord, feature flags | Not built-in |
| Tests stay offline | Easy: no token → no-op adapter | Same if we wrap it |

Polar Starter is **5% + 50¢** per transaction (orgs created on/after 27 May 2026). Paid Polar plans drop the rate. Early Member (4% + 40¢, +0.5% on subscriptions) is only for Polar orgs created before that date.

Polar is a worse fit than Stripe if we need custom enterprise invoices, mid-cycle per-seat gymnastics beyond Polar seats, or we already have a Stripe Tax stack. We do not.

Do **not** use Polar as a second team directory. Better Auth organizations remain Groxbot workspaces. Polar is money + entitlements.

## What exists in this repo today

Nothing Polar-related. Billing-shaped pieces:

- Auth is Better Auth in `packages/auth`, mounted at `/api/auth/*` on the Hono API (`apps/api/src/app.ts`).
- Workspaces are Better Auth **organizations**. Every bot, computer, thread, and secret is `workspaceId` → `organization.id` (`packages/db/src/schema`).
- Sessions already carry `activeOrganizationId`. `requireActor` needs a workspace; first-run onboarding asks to create one or join with an invite (`apps/api/src/session.ts`).
- Product API is **oRPC** (`packages/contracts`). Web, desktop, and later mobile share that contract — not Better Auth client methods.
- `MeSchema` has `workspaceId` and `isDeploymentOwner`. No plan, seats, or usage.
- Self-host vs cloud is already a thing: packaged desktop talks to groxbot.com / api.groxbot.com; local Compose does not.
- Tests are offline: `ScriptedAgentRuntime`. Polar must follow that rule.

v1 does not need payments. Hosted computers and a paid groxbot.com are later, same bucket as store signing.

## Two Polar uses (keep them separate)

1. **Product billing** — Polar organization for groxbot.com. Subscriptions, usage, customer portal. This doc.
2. **Project funding** — optional second Polar org on the public GitHub repo (donations, sponsor-style GitHub access). Do not mix tokens, products, or webhooks with (1).

## Customer identity (the important mapping)

Polar’s Better Auth plugin creates a Polar **Customer** per **user**, with `externalId = user.id`. That is the wrong grain for Groxbot.

Groxbot bills the **workspace**:

- Computers and hosted sandbox cost sit on the workspace, not the human who clicked Send.
- Several humans share one Desk.
- `me.workspaceId` is already the unit of product data.

**Set Polar `externalId` to `organization.id` (workspace id).** Create the Polar customer when the workspace is created (or lazily on first checkout), not on every user signup.

Checkout and usage then use `customerExternalId: workspaceId`. Entitlement checks use [Customer State by external id](https://polar.sh/docs/api-reference/customers/get-customer-state-by-external-id).

Payer email on checkout is the billing manager’s user email. Polar still needs a person on the receipt; the *id* we key on is the workspace.

### Seats vs Groxbot members

Polar [seat-based pricing](https://polar.sh/docs/features/seat-based-pricing) splits **Customer** (who pays, becomes `type: "team"`) from **Member** (who uses). Benefits are granted to claimed seats, **not** to the billing customer. Custom `success_url` means the buyer does not auto-claim a seat.

Do not sync Polar members into Better Auth or the reverse. Two options:

- **v1 hosted (simpler):** one workspace plan (Hobby / Team) with included limits. Polar feature-flag benefits + a Postgres mirror. Member count is a Groxbot cap (`memberCount <= seats`), not Polar seat assignment.
- **Later:** Polar seats as the paid quantity; Groxbot still owns login. Assign seats by email / `external_member_id` = Better Auth `user.id` only if we want Polar to grant per-human benefits (Discord, license keys). Hosted product access should still be “workspace has an active subscription.”

Polar’s Better Auth docs also allow `referenceId: organizationId` on checkout while keeping the Polar customer as the user. That tracks org purchases on the *user* customer, and `customer.state()` **does not** include parent-org subscriptions. We would have to list orders/subscriptions by `referenceId` on every gate. Worse than workspace-as-customer.

## Do not use `@polar-sh/better-auth` as the primary integration

It is the path Polar advertises because we already use Better Auth. Skip it as the system of record.

| Plugin behavior | Why it fights this repo |
| --- | --- |
| `createCustomerOnSignUp: true` | Polar customer = user. Also fires on self-host signups if the plugin is always on. |
| Checkout / portal on `authClient` | Clients are supposed to call **oRPC**, including desktop and later Expo. |
| `authClient.usage.ingestion` | Polar’s own docs: the client can lie about usage. Billable events must be server-side. |
| Webhook at `/api/auth/polar/webhooks` | Fine, but Hono can mount `/polar/webhooks` without pulling Polar into auth. |
| User-scoped `customer.state()` | Misses workspace subscriptions. |

`@polar-sh/better-auth` can stay a **later convenience** for cookie-session checkout redirects only. Domain logic should not live there.

Hono’s `@polar-sh/hono` (`Checkout`, `CustomerPortal`, `Webhooks`) is closer to the API process, but checkout/portal still should go through authenticated oRPC so we attach `workspaceId` ourselves. Use the Hono helper for **webhook signature verification** if it is easier than the SDK; otherwise verify in a small API route.

## Recommended shape

Same pattern as `WakeupDriver`: a port, a fake, a Polar adapter. Polar SDK stays in the API (and maybe worker for ingest). **Think / `BotActor` must not import `@polar-sh/sdk`.**

```
Web / desktop / mobile
        │  oRPC billing.*
        v
API (Hono) ── BillingPort ── Polar SDK (hosted only)
        │                         │
        │ webhooks                │ events.ingest
        v                         v
Postgres workspace_billing     Polar Customer State
        ^
        └── entitlement checks on hosted sandbox provision, bot caps, hosted models
```

### Port (sketch)

```ts
interface BillingPort {
  enabled(): boolean;
  getEntitlement(workspaceId: string): Promise<WorkspaceEntitlement>;
  createCheckout(input: {
    workspaceId: string;
    payerUserId: string;
    productSlug: "hobby" | "team";
    successUrl: string;
  }): Promise<{ url: string }>;
  customerPortalUrl(workspaceId: string): Promise<{ url: string }>;
  ingest(events: UsageEvent[]): Promise<void>;
  applyCustomerState(state: unknown): Promise<void>;
}
```

- **No token / `POLAR_ACCESS_TOKEN` empty:** `enabled() === false`. Entitlement is unlimited for the deployment (self-host). Matches “owner of this Compose stack.”
- **Fake (tests):** in-memory plans, no HTTP.
- **Polar:** Organization Access Token, sandbox vs production.

Do not call Polar on every `threads.send`. Mirror Customer State into Postgres on `customer.state_changed` (and subscription/order webhooks as backup). Read the mirror in oRPC.

### Schema (sketch)

Workspace-scoped, not user-scoped:

```
workspace_billing
  workspace_id          PK → organization.id
  polar_customer_id     text unique
  plan                  text   -- none | hobby | team
  status                text   -- none | trialing | active | past_due | canceled | revoked
  seats                 int
  current_period_end    timestamptz
  meters                jsonb  -- { computer_minutes: { consumed, credited, balance }, ... }
  raw_state             jsonb  -- last Polar customer state (optional, for debug)
  updated_at
```

Idempotent webhook handling: store Polar event ids if we grow past “last write wins” on this row.

### oRPC (sketch)

Keep Polar out of the Better Auth client. Add to `packages/contracts`:

- `billing.status` → plan, status, seats, meters, `portalAvailable`
- `billing.checkout` → `{ url }` (server creates Polar checkout with `customerExternalId = workspaceId`)
- `billing.portal` → `{ url }`

`me` can later include a thin `plan` so the web shell can show a badge without a second round-trip. Billing UI is a **settings** surface, not chat. Takeover-for-payment in [docs/grok-bot-ui.md](./grok-bot-ui.md) is the bot’s computer, unrelated.

### Where Polar SDK lives

| Process | Polar? |
| --- | --- |
| `apps/api` | Yes: checkout, portal, webhooks, entitlement reads |
| `apps/worker` | Optional: ingest `computer_minutes` when a sandbox stops / idle-sleep fires |
| Think / `BotActor` | **No** |
| `apps/web` | No secrets. Redirects to Polar-hosted checkout/portal URLs from oRPC |

## What to sell (product, not Polar objects)

Self-host: fair-code license, BYOK, Docker computers, Polar off. Your organization only — not a public groxbot.com clone.

Hosted groxbot.com (strawman — pricing TBD):

| Plan | Polar product | Included | Metered overage |
| --- | --- | --- | --- |
| Free | none | BYOK, tiny or no hosted computer | blocked |
| Hobby | subscription + feature flags | N bots, 1 Desk, included computer minutes | `computer_minutes` |
| Team | subscription, optional seats | more members/computers, higher included minutes | same meters |

Meters that match our costs:

- **`computer_minutes`** — hosted bot computers (`@cloudflare/computer` `Workspace` on `BotActor`). Polar [delta-time ingestion](https://polar.sh/docs/features/usage-based-billing/ingestion-strategies/delta-time-strategy) is the right *idea*; implement with `events.ingest` from the worker on computer stop, `externalCustomerId = workspaceId`, metadata `{ deltaTime, botId }`. Do not trust the browser.
- **`hosted_tokens`** — only if we sell model access. Polar’s [LLM strategy](https://polar.sh/docs/features/usage-based-billing/ingestion-strategies/llm-strategy) wraps Vercel AI SDK. We use Think / Workers AI. Ingest after a run from the worker (`inputTokens`, `outputTokens`, `model`). Never meter BYOK keys.

Usage is billed on a **subscription** (Polar meters attach to subscription products). Unit price is linear; Polar volume pricing for meters is still “coming soon.” Put included allowance in Polar [credits](https://polar.sh/docs/features/usage-based-billing/credits) / credited units, or a monthly cap on the metered price.

Gate hosted features with Polar [feature-flag benefits](https://polar.sh/docs/features/benefits/feature-flags) (`hosted_computer`, `isolated_computer`, `hosted_models`) and the same names in our entitlement mirror.

## Adapter and SDK versions

As of this research (Aug 2026):

- Current Polar TypeScript docs: `createPolar` from `@polar-sh/sdk/2026-04` (`pnpm add @polar-sh/sdk@next`). Public preview; pin the API version in the import path.
- Better Auth Polar plugin and `@polar-sh/hono` examples still show `new Polar({ accessToken, server: "sandbox" })` on the stable SDK.
- We are on `better-auth` `^1.3.8`.

**Use the SDK from the API adapter, not the framework plugin, so we can pin `2026-04` and keep auth plugin-free.** Re-check `@polar-sh/hono` / `@polar-sh/better-auth` peer deps before coding. Sandbox and production are **separate Polar orgs**: tokens, products, and webhook secrets do not cross.

Env (never commit values):

```
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_ENVIRONMENT=sandbox   # or production
POLAR_PRODUCT_HOBBY=
POLAR_PRODUCT_TEAM=
```

Production webhook URL: `https://api.groxbot.com/polar/webhooks`.  
Local: Polar CLI `polar listen http://127.0.0.1:3100/` ([local webhooks](https://polar.sh/docs/integrate/webhooks/locally)). Copy the printed secret into `POLAR_WEBHOOK_SECRET`.

Polar OATs are in GitHub secret scanning. A leaked token is revoked. Same rule as `BETTER_AUTH_SECRET` / computer Worker credentials.

Checkout `successUrl` should be the **web** origin (`https://groxbot.com/settings/billing?checkout_id={CHECKOUT_ID}`), not the API. Polar `server`/`environment` must match the token.

## Entitlement flow

1. Billing manager calls `billing.checkout`. API creates Polar checkout: product from slug, `customerExternalId = workspaceId`, metadata `{ workspaceId, payerUserId }`.
2. Polar hosted checkout (tax, card, invoice). Redirect back to web.
3. Polar sends `customer.state_changed` (also subscription/order events). API verifies signature, upserts `workspace_billing`.
4. Provision paths (hosted computer, extra bots, hosted models) call `BillingPort.getEntitlement(workspaceId)` and fail closed if the mirror is missing/expired and Polar is enabled.
5. Worker ingests usage after the metered work ran. Polar aggregates; portal shows estimated charges; we refresh meters from Customer State.

Do not ingest from `apps/web`. Polar’s usage plugin client endpoint is unsafe for money.

## Tests

- Default: `BillingPort` fake, no network.
- Contract tests: checkout refused when Polar disabled vs entitlement unlimited when Polar disabled (self-host).
- Webhook tests: fixture payloads + signature helper if we vendor verify; otherwise mock the port’s `applyCustomerState`.
- Never live model APIs in CI, never Polar sandbox in CI.

## Risks

- **SDK split** — `createPolar` preview vs `new Polar()` adapters. Prefer the versioned SDK in our adapter.
- **Seat benefit grant** — if we adopt Polar seats, the billing customer does not get benefits; claimed members do. Workspace-level access must not depend on that.
- **Custom success URL** — buyer may need an explicit seat claim. Avoid seats until we need them.
- **Webhook vs live Polar** — mirror can lag; fail closed on hosted sandboxes, fail open on chat for already-provisioned local Docker.
- **Self-host footgun** — Polar plugin on `createAuth` would try to create customers without a token. Keep Polar out of `packages/auth`.
- **MoR tradeoffs** — Polar is the seller; we cannot reclaim inbound VAT. Fees are higher than raw Stripe. Fine for an OSS-hosted cloud.
- **Seller country** — payouts need Stripe Connect Express in [supported countries](https://polar.sh/docs/merchant-of-record/supported-countries). Customers can pay from most places except US-sanctioned countries.
- **Think ≠ AI SDK** — do not take the Polar LLM wrapper as-is.

## Implementation order (when we build it)

1. `BillingPort` + fake + `workspace_billing` table. oRPC `billing.status` always `plan: none` / unlimited. No Polar dependency. Tests.
2. Polar sandbox adapter: create customer by workspace id, checkout, webhook → mirror, portal URL. Manual sandbox only.
3. Gate **hosted** computers / extra bots on entitlement.
4. Meter `computer_minutes` from the worker. Polar product + feature flags.
5. Settings UI: plan, checkout button, portal link. Not in the office thread.
6. Optional `hosted_tokens`, Polar seats.

Step 1 is the only piece that belongs near the current scaffold. Steps 2–6 wait until groxbot.com is a real host with a Polar org.
