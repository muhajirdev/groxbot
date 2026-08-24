# Computers

Each bot **has a computer**. Sell that. Architecturally it is already the bot: Think `this.workspace` on `BotActor` (instance name = `botId`).

The office UI may show `{Bot}'s screen` and **Open computer** from a chat card. That pane is this teammate’s workspace — not a second identity you hire.

Do **not** bring back:

- a `computers` table or `bots.computerId`
- shared vs isolated hire
- `control_holder` / takeover / `computer.sleep`
- `computers.list` or a Computer Durable Object named by `computerId`

Hands later are still Think workspace on that bot, not a Computer DO. Live docs / slides / sheets are `AppRuntime` Durable Objects, not computers.
