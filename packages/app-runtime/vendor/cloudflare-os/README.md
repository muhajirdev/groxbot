# Docs / slides / sheets templates (Apache 2.0)

Plain `client.js` and `server.js` derived from [Cloudflare OS](https://github.com/cloudflare/cloudflare-os)
workspace Docs, Slides, and Sheets. Groxbot keeps them as source files, not
`.gadget` archives.

Copyright Cloudflare, Inc. Licensed under the Apache License, Version 2.0.
See the project `NOTICE` and `LICENSE` files.

The live app is Cloudflare-only: `AppRuntime` loads `server.js` with the
Worker Loader and runs `export class Gadget` as a Durable Object Facet.
The iframe talks Cap'n Web over a MessagePort; the parent holds the
WebSocket. No in-iframe fake Gadget, no Yjs, no Overseer, no archive format.

Rebuild stamped `src/generated/*.ts` with:

```
node packages/app-runtime/scripts/bundle-templates.mjs
```
