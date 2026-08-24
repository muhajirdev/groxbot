/** Stamped into each app Durable Object. LOADER/facets can compile this later. */
export const APP_SERVER_JS = `import { DurableObject } from "cloudflare:workers";

export class App extends DurableObject {
  async load() {
    const raw = await this.ctx.storage.get("state");
    return raw ?? null;
  }

  async save(state) {
    await this.ctx.storage.put("state", state);
    return { ok: true };
  }
}
`;
