import { DurableObject } from "cloudflare:workers";

const DEFAULT_TITLE = "Untitled CRM";
const STAGES = ["lead", "talking", "won", "lost"];

function newId() {
  return "c_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function cleanStage(value) {
  const stage = String(value || "lead");
  return STAGES.includes(stage) ? stage : "lead";
}

function cleanContact(raw, fallbackId) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 80);
  if (!name) return null;
  return {
    id: String(raw.id || fallbackId || newId()).slice(0, 40),
    name,
    company: String(raw.company || "").trim().slice(0, 80),
    email: String(raw.email || "").trim().slice(0, 120),
    note: String(raw.note || "").trim().slice(0, 400),
    stage: cleanStage(raw.stage),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function emptyDoc(title = DEFAULT_TITLE) {
  return { title, revision: 1, contacts: [], lastModified: Date.now() };
}

export class Gadget extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.subscribers = new Map();
    this.mutationQueue = Promise.resolve();
  }

  enqueueMutation(fn) {
    const result = this.mutationQueue.then(fn);
    this.mutationQueue = result.catch(() => {});
    return result;
  }

  async loadDocument() {
    const doc = await this.ctx.storage.get("crm");
    if (doc && typeof doc === "object") {
      return {
        ...emptyDoc(),
        ...doc,
        contacts: Array.isArray(doc.contacts)
          ? doc.contacts.map((row) => cleanContact(row)).filter(Boolean)
          : [],
      };
    }
    return emptyDoc();
  }

  async getDocument() {
    return this.loadDocument();
  }

  setDocument(state) {
    return this.enqueueMutation(() => this.setDocumentLocked(state));
  }

  async setDocumentLocked(state) {
    const current = await this.loadDocument();
    const title =
      state && typeof state.title === "string" && state.title.trim()
        ? state.title.trim().slice(0, 80)
        : current.title;
    const incoming = Array.isArray(state?.contacts) ? state.contacts : current.contacts;
    const contacts = incoming.map((row) => cleanContact(row)).filter(Boolean);
    const doc = {
      title,
      revision: (current.revision || 0) + 1,
      contacts,
      lastModified: Date.now(),
    };
    await this.ctx.storage.put("crm", doc);
    await this.broadcast({ type: "snapshot", document: doc });
    return doc;
  }

  setTitle(title) {
    return this.enqueueMutation(async () => {
      const current = await this.loadDocument();
      const next = {
        ...current,
        title: String(title || "").trim().slice(0, 80) || DEFAULT_TITLE,
        revision: current.revision + 1,
        lastModified: Date.now(),
      };
      await this.ctx.storage.put("crm", next);
      await this.broadcast({ type: "snapshot", document: next });
      return next;
    });
  }

  upsertContact(contact) {
    return this.enqueueMutation(async () => {
      const current = await this.loadDocument();
      const row = cleanContact(contact, contact?.id);
      if (!row) return current;
      row.updatedAt = Date.now();
      const index = current.contacts.findIndex((item) => item.id === row.id);
      const contacts = [...current.contacts];
      if (index >= 0) contacts[index] = row;
      else contacts.unshift(row);
      const next = {
        ...current,
        contacts,
        revision: current.revision + 1,
        lastModified: Date.now(),
      };
      await this.ctx.storage.put("crm", next);
      await this.broadcast({ type: "snapshot", document: next });
      return next;
    });
  }

  moveContact(id, stage) {
    return this.enqueueMutation(async () => {
      const current = await this.loadDocument();
      const nextStage = cleanStage(stage);
      const contacts = current.contacts.map((row) =>
        row.id === id ? { ...row, stage: nextStage, updatedAt: Date.now() } : row,
      );
      const next = {
        ...current,
        contacts,
        revision: current.revision + 1,
        lastModified: Date.now(),
      };
      await this.ctx.storage.put("crm", next);
      await this.broadcast({ type: "snapshot", document: next });
      return next;
    });
  }

  removeContact(id) {
    return this.enqueueMutation(async () => {
      const current = await this.loadDocument();
      const next = {
        ...current,
        contacts: current.contacts.filter((row) => row.id !== id),
        revision: current.revision + 1,
        lastModified: Date.now(),
      };
      await this.ctx.storage.put("crm", next);
      await this.broadcast({ type: "snapshot", document: next });
      return next;
    });
  }

  async subscribe(callback) {
    const dup = callback.dup();
    this.subscribers.set(dup, true);
    dup.onRpcBroken(() => {
      this.subscribers.delete(dup);
    });
    return this.loadDocument();
  }

  async broadcast(event) {
    const calls = [];
    for (const [stub] of this.subscribers) {
      calls.push(
        Promise.resolve(stub.operation(event)).catch(() =>
          this.subscribers.delete(stub),
        ),
      );
    }
    await Promise.all(calls);
  }
}
