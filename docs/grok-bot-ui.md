# Grok Bot UI copy-brief

Groxbot should **feel like Grok Bot**: a messaging app of named teammates, not a workflow builder, IDE, or Discord. Product/architecture stays ours (Postgres for team data, one Think actor per bot, sessions per thread, live apps as their own Durable Objects, oRPC, Composio). **Each bot has a computer** (Think workspace on that actor) — ship the pane, sell it. Do not copy their shared desk, takeover, or a second Computer product. **Implement on web first**; desktop reuses that UI; Expo gets the same contract later.

We could not screenshot the live desktop app (paywalled: SuperGrok Heavy / Cursor Ultra). This brief is from official docs and marketing as of 11–15 Aug 2026.

**Look at these while building:**

| What | Where |
| --- | --- |
| Marketing, job chips, computer takeover line | [x.ai/bot](https://x.ai/bot) |
| Launch post, quotes, use-case tabs | [x.ai/news/introducing-grok-bot](https://x.ai/news/introducing-grok-bot) |
| First-run steps | [docs: get started](https://docs.x.ai/grok-bot/get-started) |
| Sidebar, profile, New Agent | [docs: bots](https://docs.x.ai/grok-bot/bots) |
| Chat, `@`, groups | [docs: chat](https://docs.x.ai/grok-bot/chat-and-collaboration) |
| Agent Computer pane | [docs: computer](https://docs.x.ai/grok-bot/computer-and-apps) |
| First-run + iPhone | [docs: iOS](https://docs.x.ai/grok-bot/mobile) |
| Appearance, attention states | [docs: settings](https://docs.x.ai/grok-bot/settings-and-notifications) |
| Sidebar screenshot description (Inbox Manager, Talent Scout…) | [eesel review](https://www.eesel.ai/blog/grok-bot-review) |
| Walkthrough video | [YouTube: Cursor Just Released Grok Bot](https://www.youtube.com/watch?v=QTcZPI-g7is) |

---

## What “simple” means

Official line: *Create a Bot, message it, grant access as needed. No workflow builder.*

Quote they highlight: *“There wasn’t anything to learn. It was just like bringing on a coworker.”*

Copy this:

- First action is **talk**, not configure a graph.
- A Bot is a **contact**: name, optional job, description, avatar, one thread.
- Apps (docs / slides / sheets) open from a **card in chat**. No file manager.
- Plugins exist, but first task can be “summarize this file” with no connector.

Do not copy:

- Their shared desk, takeover, or `computers` table. Groxbot still sells a computer; it is built into the bot.
- Group chat of 2–6 Bots in v1 (see [rooms-plan.md](./rooms-plan.md)).
- Teach-by-demonstration in v1.
- Cursor-only sign-in / Ultra paywall.

---

## Layout (desktop)

Three regions. Looks like iMessage, not Linear. The computer icon in the thread header opens the right pane.

```
+------------------+---------------------------+------------------+
| SIDEBAR          | THREAD                    | COMPUTER
| [Search]     [+] |  Reja            🖥 ⚙ >> | Starting desktop
|                  |                           |  [progress]
| o New Bot  8:16  |  Yesterday 9:56 AM        |
| o Lookout  11:47 |  You: …                   | Reja's screen
| o Reja     9:56  |  Reja: …                  | [  desktop   ]
|                  |  [Computer • Done]        |
| Plugins          |  [  Message Reja      ]   | Routines
| You              |                           | [Create Routine]
+------------------+---------------------------+------------------+
```

- **Left:** roster of Bots. Search. `+` → Create new agent. Plugins and you at the bottom.
- **Center:** one conversation. Transcript is the audit log. In-thread **Computer** cards still **Open computer**. Header: computer icon, gear (profile), collapse.
- **Right:** computer icon → **Starting desktop** / `{Bot}'s screen` + **Routines**. Gear → Bot settings (name, title, description, notify). Collapse hides the pane.

Composer:

- Plain text.
- Attach / drag files (they cap ~6 at once).
- `@` = Bot, group, routine, connector.
- `/` = saved skill.
- Send while it is working = redirect. “Stop now” = halt (does not undo).

Job-title chips on marketing (use as first-bot suggestions, not as a template gallery product):

Sales Outbound · Talent Scout · Paid Media · Expense Manager · Product Performance · Bug Reproduction · Account Health · Chief of Staff

Docs examples: **Talent Scout**, **Expense Manager**, **Bug Reproduction**. Avoid **General Helper**.

---

## Visual style

- **Messaging app**, not a dashboard. No kanban of agents as the home screen.
- Each Bot: **short name**, optional **job**, **description**, **avatar**.
- Avatar onboarding: pick a **color** and a **rounded mark** (circle by default — a flat blob with two slits, not a photoreal face). Shape and mood morph; they do not crossfade. Sidebar shows that mascot like a contact photo. Working bots bounce.
- Appearance: Follow system / Light / Dark (`Cmd/Ctrl+,`).
- Attention in the list:
  - Needs attention (question, approval, handoff)
  - Unread result
  - Working / typing
- Notifications off while the window is focused; dock/sidebar still badge.
- Result cards in-thread: files, images, links, tool output — preview in place.

Copy voice: teammate, job, handoff, come back when you need approval. Not “agent run,” “workflow,” “orchestration.”

---

## Onboarding (copy this sequence)

Desktop ([get started](https://docs.x.ai/grok-bot/get-started)):

```
  Welcome
    [ Get started ]     -->  browser Cursor/Grokbot login
         |
         v
  Create a new workspace  or  Join with an invite
         |
         v
  Short tour: Bots, shared computer
  "Which tools do you use?"   (shapes suggestions; does NOT connect yet)
         |
         v
  Models (BYOK or Groxbot hosted gateway): pick default model
    Groxbot includes Workers AI (`env.AI`) through Cloudflare AI Gateway
    Paste your own OpenRouter/Anthropic/OpenAI/Cloudflare key anytime
         |
         v
  Meet a future teammate
    suggested jobs     or    [ Create your own ]
         |
         v
  Name + one primary job + how it should work
  Open the thread. First message is a real task.
```

Create-your-own fields (example from docs):

- **Name:** Piper
- **Job:** Product performance (optional)
- **Description:** operational rules — sources, output shape, **never** change production.

After that, **New** / `Cmd+N` → **Create new agent** → opens **New Agent** → **Bot actions → Edit Profile** (name, title, description, avatar) → give a task.

iPhone: Login with Cursor → first-run tour → choose first Bot → wait for computer → same roster. `+` → New Agent | New Group Chat.

**Our v1 trim:** same tour. Each Bot already has a computer (you can ignore it). Skip group chat, shared desk, and takeover. Plugins = Composio when we have it; first-run tool question can still be asked. **A model is required before hire** — Groxbot’s hosted Cloudflare AI Gateway, or a pasted key — so the first thread can talk.

### First-task recipe (surface in empty composer)

A good handoff has: outcome, sources, constraints, deliverable, when to stop for you.

Zero-connector starter they recommend:

> Summarize this document in five bullets. List every date, decision, and open question. Cite the section. Do not change the source file.

Then a tool task that may takeover-login.

---

## Computer pane

Label: **Agent Computer** (we can say **Computer**).

- Live view: clicks, typing, navigation, status (**Working** / **Idle**).
- Marketing line: each Bot already has a computer; you can ignore it.
- Closing the pane or the laptop does not stop cloud work.
- Files live in that bot’s Think workspace; conversation still gets the final artifact or a link.

**Grok:** one VM, many screens. **Groxbot v1:** the computer **is** the bot (Think workspace). Pane shows **this** teammate’s screen. Same UX. Not a second Durable Object. No takeover in v1.

---

## Profile vs chat

| Put in description (durable) | Put in a message (this task) |
| --- | --- |
| Never send mail without approval | Draft follow-ups for these 12 accounts |
| How to format weekly reports | Use last week’s numbers |

Edit: **View conversation details → Agent settings** (name, title, description, avatar, notify).

Sidebar: Pin, Hide (work continues), Show hidden, Duplicate (profile only, not history), Delete.

---

## iOS (later, same objects)

Home = Bot list. Message, dictate, photo, `@`, threads, reactions. Computer from the conversation for watch/takeover. Routines: pause/resume on mobile; edit schedule on desktop. Same Bots as desktop.

v1 web can ignore iOS chrome; keep the **contact list + thread + computer** mental model so mobile is not a rewrite.

---

## What not to build in v1 (theirs, not ours yet)

- Group of 2–6 Bots, `@everyone`
- Bot-to-bot DMs
- Teach a task (record up to 10 min)
- Command palette search across all chats
- Auto-review policy engine
- Local-computer execution
- Marketplace of skills

Empty composer and New Agent must still work without those.

---

## Implementation checklist (web)

1. Welcome → sign in → **create or join a workspace** → tour → tools → **models (BYOK)** → “meet a teammate” (name, title, description, color+shape).
2. Sidebar of Bots; click = that office thread.
3. Chat transcript with inline “working,” files, approval.
4. Computer pane: this bot’s Think workspace (empty first). No takeover, no desk RPC. Wakeup is the bot’s actor, not a queue UI.
5. Edit profile on the Bot, not a separate admin app.
6. First-run does not require Composio.
7. **Models on first-run + Settings → Models**: Groxbot hosted Workers AI (`env.AI` through Cloudflare AI Gateway) plus workspace BYOK keys (encrypted). BYOK wins. Default model is hosted Workers AI when no key is pasted. A bot can override. Hosted token usage is counted per workspace. Messaging fails closed until a matching key or the hosted gateway exists (office banner as fallback).

Sources: xAI Grok Bot docs dated around 11 Aug 2026, [x.ai/bot](https://x.ai/bot), [introducing grok bot](https://x.ai/news/introducing-grok-bot).
