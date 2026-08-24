/* Groxbot host: run a Cloudflare OS Gadget class in the iframe.
 * Parent still only bridges gadget.load / gadget.save. No Cap'n Web. */
class RpcTarget {
  dup() {
    return this;
  }
  onRpcBroken() {}
}

class MemoryStorage {
  constructor() {
    this.map = Object.create(null);
  }
  async get(key) {
    return this.map[key];
  }
  async put(key, value) {
    this.map[key] = value;
    schedulePersist();
  }
  async delete(key) {
    delete this.map[key];
    schedulePersist();
  }
}

class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.state = ctx;
    this.env = env || {};
  }
}

class WorkerEntrypoint {}

const __persist = window.gadget;
const __storage = new MemoryStorage();
const __ctx = { storage: __storage };
let persistTimer = 0;
let gadgetRef = null;
const savedMeta = { undo: [], redo: [] };

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(function () {
    void flushPersist();
  }, 40);
}

async function flushPersist() {
  if (!gadgetRef || !__persist || typeof __persist.save !== "function") return;
  await __persist.save({
    kv: __storage.map,
    undo: gadgetRef.undoStack || [],
    redo: gadgetRef.redoStack || [],
  });
}

function hydrateFromPersist(state) {
  if (!state || typeof state !== "object") return;
  if (state.kv && typeof state.kv === "object") {
    Object.assign(__storage.map, state.kv);
    if (Array.isArray(state.undo)) savedMeta.undo = state.undo;
    if (Array.isArray(state.redo)) savedMeta.redo = state.redo;
    return;
  }
  if (typeof state.html === "string") {
    __storage.map.title = state.title || "Untitled document";
    __storage.map.content = state.html;
    return;
  }
  if (Array.isArray(state.blocks) || state.revision != null) {
    __storage.map["document:v2"] = state;
    return;
  }
  if (Array.isArray(state.slides)) {
    var deck = state;
    var first = state.slides[0];
    if (first && !first.blocks) {
      deck = {
        themeVersion: "workspace.1",
        slides: state.slides.map(function (slide, index) {
          var id = slide.id || "s" + (index + 1);
          var cover = index === 0;
          return {
            id: id,
            title: slide.title,
            background: cover
              ? { color: "#F6821F", inset: false, coverOrange: true }
              : { color: "#FFFFFF", inset: false, dotGrid: 0 },
            blocks: [
              {
                id: id + "_title",
                type: "title",
                x: cover ? 33 : 35,
                y: cover ? 197 : 76,
                w: cover ? 687 : 984,
                props: {
                  text: slide.title || "Untitled",
                  fontSize: cover ? 58 : 28,
                  weight: cover ? 700 : 600,
                  color: cover ? "#FFFFFF" : "#000000",
                  letterSpacing: "-0.03em",
                  lineHeight: cover ? 1.1 : 1.2,
                  highlight: "",
                },
              },
              {
                id: id + "_body",
                type: "text",
                x: 36,
                y: cover ? 533 : 204,
                w: cover ? 553 : 760,
                props: {
                  text: slide.body || "",
                  fontSize: cover ? 17 : 19,
                  weight: cover ? 600 : 400,
                  color: cover ? "#FFFFFF" : "#747474",
                  family: "sans",
                  align: "left",
                  lineHeight: cover ? 1.5 : 1.6,
                },
              },
            ],
          };
        }),
      };
    }
    __storage.map.deck = deck;
    return;
  }
  if (state.cells && typeof state.cells === "object" && !state.sheetOrder) {
    var sheetId = "s_main";
    var cells = {};
    Object.keys(state.cells).forEach(function (ref) {
      var value = state.cells[ref];
      var text =
        value != null && typeof value === "object" && "value" in value
          ? value.value
          : value;
      cells[ref] = {
        value: text == null ? "" : String(text),
        fmt: null,
        version: 1,
      };
    });
    __storage.map.meta = {
      revision: 1,
      title: "Untitled spreadsheet",
      sheetOrder: [sheetId],
      sheets: {
        [sheetId]: {
          id: sheetId,
          name: "Sheet1",
          rows: 100,
          cols: 26,
          colWidths: {},
          rowHeights: {},
          frozenRows: 0,
          frozenCols: 0,
        },
      },
      lastModified: Date.now(),
    };
    __storage.map["cells:" + sheetId] = cells;
  }
}

let persisted = null;
try {
  persisted = await __persist.load();
} catch (err) {
  persisted = null;
}
hydrateFromPersist(persisted);
