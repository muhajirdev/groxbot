export const slidesClientJs = `
(function () {
  const style = document.createElement("style");
  style.textContent = [
    ":root{color-scheme:dark;--bg:#111;--card:#1a1a1a;--line:#2a2a2a;--ink:#eee;--muted:#888;--accent:#e1632e}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}",
    ".app{display:grid;grid-template-columns:200px 1fr;height:100%}",
    ".list{border-right:1px solid var(--line);overflow:auto;padding:10px}",
    ".item{border:1px solid var(--line);border-radius:10px;padding:8px;margin-bottom:8px;cursor:pointer;background:var(--card)}",
    ".item.on{border-color:var(--accent)}",
    ".item small{display:block;color:var(--muted);font-size:11px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".add{width:100%;border:1px dashed var(--line);background:transparent;color:var(--ink);border-radius:10px;padding:8px;cursor:pointer}",
    ".stage{display:flex;flex-direction:column;padding:20px;gap:12px;overflow:auto}",
    ".canvas{flex:1;background:#fff;color:#111;border-radius:12px;padding:36px 40px;min-height:280px}",
    ".htitle,.hbody{width:100%;border:0;background:transparent;outline:none;color:inherit}",
    ".htitle{font:700 28px/1.2 ui-sans-serif,system-ui}",
    ".hbody{margin-top:16px;font:16px/1.5 ui-sans-serif,system-ui;min-height:8em;resize:none}",
  ].join("");
  document.head.appendChild(style);

  let slides = [];
  let current = 0;
  let timer = 0;

  const list = document.createElement("div");
  list.className = "list";
  const stage = document.createElement("div");
  stage.className = "stage";
  const canvas = document.createElement("div");
  canvas.className = "canvas";
  const htitle = document.createElement("input");
  htitle.className = "htitle";
  htitle.placeholder = "Slide title";
  const hbody = document.createElement("textarea");
  hbody.className = "hbody";
  hbody.placeholder = "Talking points";
  canvas.appendChild(htitle);
  canvas.appendChild(hbody);
  stage.appendChild(canvas);
  const app = document.createElement("div");
  app.className = "app";
  app.appendChild(list);
  app.appendChild(stage);
  document.body.appendChild(app);

  function id() {
    return "s" + Math.random().toString(36).slice(2, 8);
  }
  function currentSlide() {
    return slides[current];
  }
  function paintList() {
    list.innerHTML = "";
    slides.forEach(function (slide, index) {
      const btn = document.createElement("div");
      btn.className = "item" + (index === current ? " on" : "");
      btn.innerHTML = "<div>" + (slide.title || "Slide") + "</div><small>" + (slide.body || "") + "</small>";
      btn.addEventListener("click", function () {
        current = index;
        paint();
      });
      list.appendChild(btn);
    });
    const add = document.createElement("button");
    add.className = "add";
    add.type = "button";
    add.textContent = "Add slide";
    add.addEventListener("click", function () {
      slides.push({ id: id(), title: "New slide", body: "" });
      current = slides.length - 1;
      paint();
      flush();
    });
    list.appendChild(add);
  }
  function paintStage() {
    const slide = currentSlide();
    if (!slide) return;
    htitle.value = slide.title || "";
    hbody.value = slide.body || "";
  }
  function paint() {
    paintList();
    paintStage();
  }
  function schedule() {
    const slide = currentSlide();
    if (slide) {
      slide.title = htitle.value;
      slide.body = hbody.value;
    }
    clearTimeout(timer);
    timer = setTimeout(flush, 280);
    paintList();
  }
  async function flush() {
    await gadget.save({ slides: slides });
  }
  htitle.addEventListener("input", schedule);
  hbody.addEventListener("input", schedule);

  gadget.load().then(function (state) {
    slides = (state && state.slides) ? state.slides : [];
    if (!slides.length) slides = [{ id: id(), title: "Untitled deck", body: "" }];
    current = 0;
    paint();
  });
})();
`.trim();
