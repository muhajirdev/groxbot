# Cloudflare OS workspace gadgets (Apache 2.0)

These files are derived from [Cloudflare OS](https://github.com/cloudflare/cloudflare-os)
workspace format blueprints (`workspace-docs`, `workspace-slides`, `workspace-sheets`).

Copyright Cloudflare, Inc. Licensed under the Apache License, Version 2.0.
See the project `NOTICE` and `LICENSE` files.

Groxbot does not run Cap’n Web, Yjs, or the Cloudflare OS Overseer. Templates
are stamped into an App Durable Object; the iframe talks to the parent with
`gadget.load` / `gadget.save` only. A small host in the iframe implements the
original Gadget RPC surface (`subscribe`, `applyOperation`, `getDeck`, …)
against that snapshot.

Rebuild stamped `src/generated/*.client.ts` with:

```
node packages/app-runtime/scripts/bundle-templates.mjs
```
