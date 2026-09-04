# Computers

Each bot **has a computer**. Sell that. Architecturally it is already the bot: `@cloudflare/computer` `Workspace` on `BotActor` (instance name = `botId`). Files live in that Durable Object’s SQLite (`vfs_*`), not R2, not a second Durable Object.

Think still owned the v1 office Session. That is gone: office chat is Pi over Cap’n Web. Computer still does **not** own bash-less Think disk. `BotActor` keeps a Think-shaped `this.workspace` adapter over `computer.fs` so Code Mode `execute`, skills, and the office pane share one tree. File tools come from `@cloudflare/computer/tools` (`createAITools`). Bash is Computer **Worker shell** (`just-bash` in a Dynamic Worker: `LOADER` + `experimental` + exported `WorkspaceServiceProxy`). Existing `cf_workspace_default` rows copy once onto that tree.

The office UI may show `{Bot}'s screen` and **Open computer** from a chat card. That pane is this teammate’s workspace — not a second identity you hire.

Do **not** bring back:

- a `computers` table or `bots.computerId`
- shared vs isolated hire
- `control_holder` / takeover / `computer.sleep`
- `computers.list` or a Computer Durable Object named by `computerId`
- Think `@cloudflare/shell` as the computer, or Think `bash`

Hands later are still this bot’s Computer workspace, not a Computer DO. Live docs / slides / sheets are `AppRuntime` Durable Objects, not computers. Worker JavaScript and Container backends stay later.
