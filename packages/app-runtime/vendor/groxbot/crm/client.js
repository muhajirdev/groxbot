const clientId = Math.random().toString(36).slice(2);

const STAGES = [
  { id: "lead", label: "Lead", hint: "New names" },
  { id: "talking", label: "Talking", hint: "In motion" },
  { id: "won", label: "Won", hint: "Closed" },
  { id: "lost", label: "Lost", hint: "Not now" },
];

const style = document.createElement("style");
style.textContent = `
:root {
  color-scheme: light;
  --bg: #f3efe6;
  --paper: #fffdf8;
  --ink: #1c1914;
  --muted: #6f685c;
  --line: rgba(28,25,20,0.10);
  --lead: #c4a574;
  --talking: #3d6b8a;
  --won: #2f7a58;
  --lost: #8a6f6a;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink);
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
.app { display: flex; flex-direction: column; height: 100%; }
.top {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px 10px; border-bottom: 1px solid var(--line);
  background: var(--paper);
}
.title {
  appearance: none; border: 0; background: transparent;
  font: inherit; font-size: 20px; font-weight: 650; letter-spacing: -0.03em;
  min-width: 0; flex: 1; color: inherit; outline: none;
}
.add {
  appearance: none; border: 1px solid var(--ink); background: var(--ink); color: var(--paper);
  border-radius: 999px; padding: 8px 14px; font: 600 12px ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer;
}
.board {
  flex: 1; display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 10px; padding: 12px; overflow: auto; align-items: start;
}
.col {
  background: color-mix(in srgb, var(--paper) 88%, var(--tint, var(--lead)));
  border-radius: 16px; min-height: 220px; padding: 10px;
  border: 1px solid var(--line);
}
.col[data-stage="lead"] { --tint: var(--lead); }
.col[data-stage="talking"] { --tint: var(--talking); }
.col[data-stage="won"] { --tint: var(--won); }
.col[data-stage="lost"] { --tint: var(--lost); }
.col h2 {
  margin: 4px 6px 10px; font-size: 12px; letter-spacing: 0.12em;
  text-transform: uppercase; font-family: ui-sans-serif, system-ui, sans-serif;
}
.col .hint { display: block; font-size: 10px; color: var(--muted); letter-spacing: 0.08em; }
.card {
  background: var(--paper); border-radius: 12px; padding: 10px 11px; margin-bottom: 8px;
  box-shadow: 0 1px 0 var(--line); cursor: pointer; border: 1px solid transparent;
}
.card:hover { border-color: var(--ink); }
.card .name { font-size: 15px; font-weight: 650; }
.card .meta { font-size: 12px; color: var(--muted); margin-top: 2px;
  font-family: ui-sans-serif, system-ui, sans-serif; }
.empty { color: var(--muted); font-size: 13px; padding: 18px 8px; }
.overlay {
  position: fixed; inset: 0; background: rgba(28,25,20,0.28);
  display: flex; align-items: flex-end; justify-content: center; z-index: 4;
}
.sheet {
  width: min(420px, 100%); background: var(--paper); border-radius: 18px 18px 0 0;
  padding: 16px 16px 20px; display: grid; gap: 8px;
}
.sheet h3 { margin: 0 0 4px; font-size: 18px; }
.sheet input, .sheet textarea, .sheet select {
  width: 100%; border: 1px solid var(--line); border-radius: 10px;
  padding: 9px 10px; font: 14px ui-sans-serif, system-ui, sans-serif;
  background: #fff; color: var(--ink);
}
.sheet textarea { min-height: 72px; resize: vertical; }
.row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.row button {
  appearance: none; border-radius: 10px; padding: 8px 12px; cursor: pointer;
  font: 600 13px ui-sans-serif, system-ui, sans-serif;
}
.ghost { border: 1px solid var(--line); background: transparent; }
.danger { border: 0; background: transparent; color: #8a3b32; margin-right: auto; }
.primary { border: 0; background: var(--ink); color: var(--paper); }
@media (max-width: 720px) {
  .board { grid-template-columns: 1fr 1fr; }
}
`;
document.head.appendChild(style);

function el(tag, props = {}, kids = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(kids)) {
    if (child) node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

let doc = { title: "Untitled CRM", contacts: [], revision: 0 };
const titleInput = el("input", { class: "title", value: doc.title, "aria-label": "CRM title" });
const columns = {};
const board = el("div", { class: "board" });
for (const stage of STAGES) {
  const list = el("div");
  const col = el("div", { class: "col", "data-stage": stage.id }, [
    el("h2", {}, [stage.label, el("span", { class: "hint" }, stage.hint)]),
    list,
  ]);
  columns[stage.id] = list;
  board.append(col);
}

document.body.append(
  el("div", { class: "app" }, [
    el("div", { class: "top" }, [
      titleInput,
      el("button", { class: "add", type: "button", onClick: () => editContact(null) }, "Add"),
    ]),
    board,
  ]),
);

function render() {
  titleInput.value = doc.title || "Untitled CRM";
  for (const stage of STAGES) {
    const list = columns[stage.id];
    const rows = doc.contacts.filter((row) => row.stage === stage.id);
    list.replaceChildren();
    if (!rows.length) {
      list.append(el("div", { class: "empty" }, "Empty"));
      continue;
    }
    for (const row of rows) {
      const card = el("button", { class: "card", type: "button" }, [
        el("div", { class: "name" }, row.name),
        el("div", { class: "meta" }, [row.company, row.email].filter(Boolean).join(" · ") || "No company"),
      ]);
      card.addEventListener("click", () => editContact(row));
      list.append(card);
    }
  }
}

function closeSheet() {
  document.querySelector(".overlay")?.remove();
}

function editContact(existing) {
  closeSheet();
  const name = el("input", { value: existing?.name || "", placeholder: "Name" });
  const company = el("input", { value: existing?.company || "", placeholder: "Company" });
  const email = el("input", { value: existing?.email || "", placeholder: "Email" });
  const note = el("textarea", { placeholder: "Note" });
  note.value = existing?.note || "";
  const stage = el("select");
  for (const item of STAGES) {
    const opt = el("option", { value: item.id }, item.label);
    if (item.id === (existing?.stage || "lead")) opt.selected = true;
    stage.append(opt);
  }
  const overlay = el("div", { class: "overlay" }, [
    el("div", { class: "sheet" }, [
      el("h3", {}, existing ? "Edit contact" : "New contact"),
      name, company, email, stage, note,
      el("div", { class: "row" }, [
        existing
          ? el("button", {
              class: "danger",
              type: "button",
              onClick: async () => {
                await gadget.removeContact(existing.id);
                closeSheet();
              },
            }, "Remove")
          : el("span"),
        el("button", { class: "ghost", type: "button", onClick: closeSheet }, "Cancel"),
        el("button", {
          class: "primary",
          type: "button",
          onClick: async () => {
            await gadget.upsertContact({
              id: existing?.id,
              name: name.value,
              company: company.value,
              email: email.value,
              note: note.value,
              stage: stage.value,
            });
            closeSheet();
          },
        }, "Save"),
      ]),
    ]),
  ]);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) closeSheet();
  });
  document.body.append(overlay);
  name.focus();
}

titleInput.addEventListener("change", () => {
  gadget.setTitle(titleInput.value);
});

class Callbacks extends RpcTarget {
  operation(event) {
    if (event?.document) {
      doc = event.document;
      render();
    }
  }
}

try {
  doc = await gadget.subscribe(new Callbacks());
  render();
} catch (error) {
  console.error(error);
}
