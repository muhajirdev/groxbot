# Docs / slides / sheets templates (Apache 2.0)

Plain `client.js` and `server.js` derived from [Cloudflare OS](https://github.com/cloudflare/cloudflare-os)
workspace Docs, Slides, and Sheets. Groxbot keeps them as source files, not
`.gadget` archives.

Copyright Cloudflare, Inc. Licensed under the Apache License, Version 2.0.
See the project `NOTICE` and `LICENSE` files.

The iframe talks to the parent with `gadget.load` / `gadget.save` only. A small
host in the iframe implements subscribe / applyOperation / getDeck against that
snapshot. No Cap’n Web, Yjs, Overseer, or archive format.

Rebuild stamped `src/generated/*.client.ts` with:

```
node packages/app-runtime/scripts/bundle-templates.mjs
```
