# Groxbot gadget templates

CRM and tic-tac-toe live next to the Cloudflare OS docs/slides/sheets copies.
Same contract: `client.js` builds the iframe UI, `server.js` exports
`class Gadget`, SQLite on the facet, Cap’n Web `gadget.*` RPC.

Rebuild stamped `src/generated/*.ts` with:

```
node packages/app-runtime/scripts/bundle-templates.mjs
```
