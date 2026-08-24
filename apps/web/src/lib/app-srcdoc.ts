const GADGET_PREFIX = `let gadget;
{
  const { port1, port2 } = new MessageChannel();
  window.parent.postMessage("handshake", "*", [port2]);
  gadget = newMessagePortRpcSession(port1);
}
window.open = () => null;
`;

function capnwebImport(capnwebBundle: string): string {
  const annotated = `//# sourceURL=jsrpc.js\n${capnwebBundle}`;
  const encoded = btoa(annotated);
  return `import { newMessagePortRpcSession } from "data:text/javascript;charset=utf-8;base64,${encoded}";\n`;
}

export function appSrcDoc(jsCode: string, capnwebBundle = ""): string {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' data: blob:",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
  const moduleCode = `${capnwebImport(capnwebBundle)}${GADGET_PREFIX}\n${jsCode}`;
  const src = `data:text/javascript,${encodeURIComponent(moduleCode)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;height:100%;background:#f6f6f4}</style></head><body><script type="module" src="${src}"></script></body></html>`;
}
