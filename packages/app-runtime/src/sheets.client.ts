export const sheetsClientJs = `
(function () {
  const COLS = 8;
  const ROWS = 16;
  const style = document.createElement("style");
  style.textContent = [
    ":root{color-scheme:dark;--bg:#111;--card:#1a1a1a;--line:#2a2a2a;--ink:#eee;--muted:#888;--accent:#e1632e}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:13px/1.4 ui-sans-serif,system-ui,sans-serif}",
    ".bar{display:flex;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);align-items:center}",
    ".bar b{min-width:36px;color:var(--muted)}",
    ".bar input{flex:1;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 8px;outline:none}",
    ".grid{overflow:auto;height:calc(100% - 42px)}",
    "table{border-collapse:collapse;min-width:100%}",
    "th,td{border:1px solid var(--line);min-width:88px;height:28px;padding:0}",
    "th{background:#161616;color:var(--muted);font-weight:600;text-align:center}",
    "td input{width:100%;height:100%;border:0;background:transparent;color:var(--ink);padding:0 6px;outline:none;font:inherit}",
    "td.on{outline:2px solid var(--accent);outline-offset:-2px}",
  ].join("");
  document.head.appendChild(style);

  function colName(c) { return String.fromCharCode(65 + c); }
  function ref(r, c) { return colName(c) + (r + 1); }
  function parseRef(token) {
    const m = /^([A-H])([1-9][0-9]?)$/i.exec(String(token).trim());
    if (!m) return null;
    return { c: m[1].toUpperCase().charCodeAt(0) - 65, r: Number(m[2]) - 1 };
  }

  let cells = {};
  let active = "A1";
  let timer = 0;

  const bar = document.createElement("div");
  bar.className = "bar";
  const label = document.createElement("b");
  const formula = document.createElement("input");
  bar.appendChild(label);
  bar.appendChild(formula);
  const gridWrap = document.createElement("div");
  gridWrap.className = "grid";
  const table = document.createElement("table");
  gridWrap.appendChild(table);
  document.body.appendChild(bar);
  document.body.appendChild(gridWrap);

  const inputs = {};

  function raw(cellRef) {
    const v = cells[cellRef];
    return v == null ? "" : String(v);
  }
  function toNum(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.charAt(0) === "#") return 0;
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  function evalCell(cellRef, seen) {
    if (seen[cellRef]) return "#CYCLE!";
    seen[cellRef] = true;
    const value = raw(cellRef);
    if (!value) return "";
    if (value.charAt(0) !== "=") return value;
    const expr = value.slice(1).trim();
    const sum = /^SUM\\(([A-H][0-9]+):([A-H][0-9]+)\\)$/i.exec(expr);
    if (sum) {
      const a = parseRef(sum[1]);
      const b = parseRef(sum[2]);
      if (!a || !b) return "#REF!";
      let total = 0;
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
          const inner = evalCell(ref(r, c), seen);
          if (typeof inner === "string" && inner.charAt(0) === "#") return inner;
          total += toNum(inner);
        }
      }
      return total;
    }
    const parts = expr.split(/([+\\-])/);
    if (parts.length >= 1) {
      let acc = null;
      let op = "+";
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (!part) continue;
        if (part === "+" || part === "-") { op = part; continue; }
        const loc = parseRef(part);
        const inner = loc ? evalCell(ref(loc.r, loc.c), Object.assign({}, seen)) : part;
        if (typeof inner === "string" && inner.charAt(0) === "#") return inner;
        const n = toNum(inner);
        acc = acc == null ? n : (op === "-" ? acc - n : acc + n);
      }
      return acc == null ? value : acc;
    }
    return value;
  }
  function display(cellRef) {
    const value = raw(cellRef);
    if (!value) return "";
    if (value.charAt(0) !== "=") return value;
    return String(evalCell(cellRef, {}));
  }
  function paintCell(cellRef) {
    const input = inputs[cellRef];
    if (!input) return;
    input.value = cellRef === active ? raw(cellRef) : display(cellRef);
  }
  function paintAll() {
    Object.keys(inputs).forEach(paintCell);
    label.textContent = active;
    formula.value = raw(active);
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, 280);
  }
  async function flush() {
    await gadget.save({ cells: cells });
  }
  function setActive(cellRef) {
    const prev = inputs[active];
    if (prev && prev.parentElement) prev.parentElement.classList.remove("on");
    active = cellRef;
    const next = inputs[active];
    if (next && next.parentElement) next.parentElement.classList.add("on");
    paintAll();
    if (next) next.focus();
  }

  const head = document.createElement("tr");
  head.appendChild(document.createElement("th"));
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement("th");
    th.textContent = colName(c);
    head.appendChild(th);
  }
  table.appendChild(head);
  for (let r = 0; r < ROWS; r++) {
    const tr = document.createElement("tr");
    const rh = document.createElement("th");
    rh.textContent = String(r + 1);
    tr.appendChild(rh);
    for (let c = 0; c < COLS; c++) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      const cellRef = ref(r, c);
      inputs[cellRef] = input;
      input.addEventListener("focus", function () { setActive(cellRef); });
      input.addEventListener("input", function () {
        cells[cellRef] = input.value;
        formula.value = input.value;
        schedule();
      });
      input.addEventListener("blur", paintAll);
      td.appendChild(input);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  formula.addEventListener("input", function () {
    cells[active] = formula.value;
    const input = inputs[active];
    if (input) input.value = formula.value;
    schedule();
  });
  formula.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      paintAll();
    }
  });

  gadget.load().then(function (state) {
    cells = (state && state.cells) ? state.cells : {};
    paintAll();
  });
})();
`.trim();
