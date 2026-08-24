const GADGET_BRIDGE = `
(function () {
  var next = 1;
  var pending = {};
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "gadget:result") return;
    var wait = pending[data.id];
    if (!wait) return;
    delete pending[data.id];
    if (data.error) wait.reject(new Error(data.error));
    else wait.resolve(data.result);
  });
  function call(method, args) {
    var id = next++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ type: "gadget:call", id: id, method: method, args: args || [] }, "*");
    });
  }
  window.gadget = {
    load: function () { return call("load", []); },
    save: function (state) { return call("save", [state]); }
  };
})();
`.trim();

export function appSrcDoc(jsCode: string): string {
  const csp =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; frame-ancestors 'none'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;height:100%;background:#111}</style></head><body><script>${GADGET_BRIDGE}</script><script>${jsCode}</script></body></html>`;
}
