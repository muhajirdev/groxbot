# Onboarding reference — Multica

Captured 3 Sep 2026 from [multica.ai](https://multica.ai) (post-login welcome). Screenshot: [onboarding-multica.jpg](./onboarding-multica.jpg).

Visual reference for Groxbot’s first-run **welcome / gate**, not for the office itself. Sequence still follows [grok-bot-ui.md](../grok-bot-ui.md) (workspace → tour → tools → models → hire). Do not copy Multica’s ticket IDs or status-board metaphor — Groxbot is a messaging app of named teammates.

## Layout

Full-bleed dark split. No chrome besides **Log out** top-right.

```
+----------------------------------+----------------------------------+
|  * Welcome to Multica            |  serif pull-quote, centered      |
|                                  |                                  |
|  Your AI teammates, in           |  [ You @Content @Research ]      |
|  one workspace.                  |  [ Content Agent · In Progress ] |
|                                  |  [ Research Agent · Done       ] |
|  Assign them work like you'd     |  [ Review Agent · In Review    ] |
|  assign a colleague — …          |  [ Coding Agent · Done         ] |
|                                  |                                  |
|  Desktop bundles the runtime —   |                                  |
|  nothing to install. Continue    |                                  |
|  on web to connect your own CLI. |                                  |
|                                  |                                  |
|  [ Download Desktop ]            |                                  |
|  Continue on web →               |                                  |
+----------------------------------+----------------------------------+
```

- **Left ~40%:** logo + welcome, headline, one-line job, platform note, two CTAs.
- **Right ~60%:** stacked activity cards that *show* the product. Decorative — not a form.
- Generous left padding. Cards sit in a vertical stack, slightly offset, like a live feed.

## Copy pattern

| Slot | Their line | Why it works |
| --- | --- | --- |
| Greeting | Welcome to Multica | Named product, not “Get started”. |
| Headline | Your AI teammates, in **one workspace.** | Outcome first. Emphasis (italic serif, ice blue) only on the last two words. |
| Body | Assign them work like you'd assign a colleague — they pick it up, update status, and comment when done. | Colleague verbs. Em dash. One sentence. |
| Platform note | Desktop bundles the runtime — nothing to install. Continue on web to connect your own CLI. | Honest split of what each path is for. |
| Primary | Download Desktop | Filled white, download glyph. |
| Secondary | Continue on web → | Ghost / text + arrow. Same weight as a choice, not a leftover. |

Pull-quote over the mock: *Every issue, every thread, every decision — shared by your team and agents.*

## Visual tokens

- Background near `#0A0A0A`. Cards slightly lifted (`#141414` range) with a 1px hairline.
- Body: tight white sans. Display accent: italic serif, ice blue (`#A8C5FF` range) — only on the headline kicker and the right-column quote.
- Status dots: yellow In Progress, green In Review, blue check Done + relative time.
- Each card: avatar/name, `@` mentions, ticket chip, one sentence, status on the bottom edge.
- Radius is large (pill CTAs, ~16px cards). Almost no shadow; contrast does the work.

## Steal for Groxbot

- Split welcome: copy + CTA left, **product proof** right.
- Log out / Sign out on the gate.
- Two honest paths instead of a single “Get started”.

Visual language stays Groxbot (Meet Groxbot, thesis serif, thread bubbles, Working/Done pills). Proof shows official Grok Bot jobs (Sales Outbound, Talent Scout, Expense Manager, Bug Reproduction) — not a ticket feed.

## Do not steal

- Ticket keys (`MCA-42`) and In Review / In Progress as the home metaphor.
- A status board of agents as the product. Home is still the thread.
- “Connect your own CLI” as a first-run promise. Groxbot’s computer is the bot’s Think workspace.
