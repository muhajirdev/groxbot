export const docsClientJs = `
(function () {
  const style = document.createElement("style");
  style.textContent = [
    ":root{color-scheme:dark;--bg:#111;--card:#1a1a1a;--line:#2a2a2a;--ink:#eee;--muted:#888;--accent:#e1632e}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}",
    ".wrap{display:flex;flex-direction:column;height:100%}",
    ".title{border:0;background:transparent;color:var(--ink);font:600 22px/1.3 ui-sans-serif,system-ui;padding:16px 20px 8px;outline:none;width:100%}",
    ".page{flex:1;overflow:auto;padding:0 20px 24px}",
    ".editor{min-height:100%;outline:none}",
    ".editor:empty:before{content:'Start writing…';color:var(--muted)}",
  ].join("");
  document.head.appendChild(style);

  const title = document.createElement("input");
  title.className = "title";
  title.placeholder = "Untitled";
  const editor = document.createElement("div");
  editor.className = "editor";
  editor.contentEditable = "true";
  const page = document.createElement("div");
  page.className = "page";
  page.appendChild(editor);
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.appendChild(title);
  wrap.appendChild(page);
  document.body.appendChild(wrap);

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(flush, 280);
  }
  async function flush() {
    await gadget.save({ title: title.value.trim() || "Untitled", html: editor.innerHTML });
  }
  title.addEventListener("input", schedule);
  editor.addEventListener("input", schedule);

  gadget.load().then(function (state) {
    if (!state) return;
    title.value = state.title || "";
    editor.innerHTML = state.html || "<p></p>";
  });
})();
`.trim();
