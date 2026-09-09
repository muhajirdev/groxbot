const clientId = Math.random().toString(36).slice(2);
let mark = "X";
let game = {
  title: "Tic-tac-toe",
  board: Array.from({ length: 9 }, () => null),
  turn: "X",
  winner: null,
};

const style = document.createElement("style");
style.textContent = `
:root {
  color-scheme: light;
  --felt: #143d32;
  --chalk: #f4efe4;
  --x: #f2c14e;
  --o: #e8ddd0;
  --line: rgba(244,239,228,0.18);
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--felt); color: var(--chalk);
  font-family: "Iowan Old Style", Palatino, Georgia, serif; }
.app { height: 100%; display: flex; flex-direction: column; align-items: center; padding: 18px 16px 24px; }
.top { width: min(420px, 100%); display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
h1 { margin: 0; font-size: 22px; letter-spacing: -0.03em; font-weight: 650; }
.status { font: 600 12px ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85; }
.board {
  margin-top: 22px; width: min(360px, 100%);
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}
.cell {
  aspect-ratio: 1; border: 0; border-radius: 18px; cursor: pointer;
  background: rgba(244,239,228,0.08); color: var(--chalk);
  font-size: clamp(36px, 10vw, 56px); font-weight: 700;
}
.cell:hover { background: rgba(244,239,228,0.14); }
.cell[disabled] { cursor: default; }
.cell.x { color: var(--x); }
.cell.o { color: var(--o); }
.controls { margin-top: 18px; display: flex; gap: 8px; }
.controls button {
  appearance: none; border-radius: 999px; padding: 8px 14px; cursor: pointer;
  font: 600 12px ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase;
}
.pick { border: 1px solid var(--line); background: transparent; color: var(--chalk); }
.pick.on { background: var(--chalk); color: var(--felt); border-color: var(--chalk); }
.reset { border: 0; background: var(--x); color: #2a1f08; }
.hint { margin-top: 14px; font-size: 13px; opacity: 0.75; text-align: center; max-width: 28ch; }
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

const statusEl = el("div", { class: "status" });
const cells = Array.from({ length: 9 }, (_, index) => {
  const btn = el("button", { class: "cell", type: "button" });
  btn.addEventListener("click", async () => {
    if (game.winner || game.board[index] || game.turn !== mark) return;
    await gadget.move(index, mark);
  });
  return btn;
});
const pickX = el("button", { class: "pick on", type: "button" }, "Play X");
const pickO = el("button", { class: "pick", type: "button" }, "Play O");
pickX.addEventListener("click", () => {
  mark = "X";
  render();
});
pickO.addEventListener("click", () => {
  mark = "O";
  render();
});

document.body.append(
  el("div", { class: "app" }, [
    el("div", { class: "top" }, [el("h1", {}, "Tic-tac-toe"), statusEl]),
    el("div", { class: "board" }, cells),
    el("div", { class: "controls" }, [
      pickX,
      pickO,
      el("button", { class: "reset", type: "button", onClick: () => gadget.reset() }, "New round"),
    ]),
    el("p", { class: "hint" }, "Anyone in this room can sit as X or O. The board is shared."),
  ]),
);

function render() {
  pickX.classList.toggle("on", mark === "X");
  pickO.classList.toggle("on", mark === "O");
  if (game.winner === "draw") statusEl.textContent = "Draw";
  else if (game.winner) statusEl.textContent = `${game.winner} wins`;
  else statusEl.textContent = `${game.turn} to play · you are ${mark}`;
  game.board.forEach((value, index) => {
    const cell = cells[index];
    cell.textContent = value || "";
    cell.classList.toggle("x", value === "X");
    cell.classList.toggle("o", value === "O");
    cell.disabled = Boolean(game.winner || value);
  });
}

class Callbacks extends RpcTarget {
  operation(event) {
    if (event?.game) {
      game = event.game;
      render();
    }
  }
}

try {
  game = await gadget.subscribe(new Callbacks());
  render();
} catch (error) {
  console.error(error);
}
