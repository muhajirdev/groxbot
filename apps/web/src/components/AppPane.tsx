import capnwebBundle from "capnweb?raw";
import { newMessagePortRpcSession, newWebSocketRpcSession } from "capnweb";
import { useEffect, useRef, useState } from "react";
import { APP_KIND_LABEL } from "../lib/app-kind";
import { appRpcUrl } from "../lib/app-rpc";
import { appSrcDoc } from "../lib/app-srcdoc";
import { CloseIcon } from "./Icons";

type AppHost = {
  getUiBundle(): Promise<{ jsCode: string } | null>;
  connectToGadget(): unknown;
};

export function AppPane(props: {
  appId: string;
  title: string;
  templateId: keyof typeof APP_KIND_LABEL;
  onCollapse: () => void;
}) {
  return (
    <aside className="pane app-pane">
      <div className="pane-head drag">
        <span className="pane-title">
          {APP_KIND_LABEL[props.templateId]} · {props.title}
        </span>
        <div className="row tight no-drag">
          <button
            className="icon-btn"
            type="button"
            aria-label="Close"
            title="Close"
            onClick={props.onCollapse}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <AppFrame appId={props.appId} title={props.title} />
    </aside>
  );
}

function AppFrame(props: { appId: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState("");
  const [srcDoc, setSrcDoc] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const host = newWebSocketRpcSession<AppHost>(appRpcUrl(props.appId));
    const iframeSessions: Array<{ [Symbol.dispose]?: () => void }> = [];

    void host
      .getUiBundle()
      .then((bundle) => {
        if (cancelled) return;
        if (!bundle?.jsCode) {
          setError("Could not open this.");
          setLoading(false);
          return;
        }
        setSrcDoc(appSrcDoc(bundle.jsCode, capnwebBundle));
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof Error ? caught.message : "Could not open this.",
        );
        setLoading(false);
      });

    const onMessage = (event: MessageEvent) => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== "null") return;
      if (event.data !== "handshake" || !event.ports?.[0]) return;
      const port = event.ports[0];
      try {
        const gadget = host.connectToGadget();
        iframeSessions.push(newMessagePortRpcSession(port, gadget as object));
      } catch (caught: unknown) {
        port.close();
        setError(
          caught instanceof Error ? caught.message : "Could not connect",
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      for (const session of iframeSessions) session[Symbol.dispose]?.();
      host[Symbol.dispose]?.();
    };
  }, [props.appId]);

  return (
    <div className="app-frame-wrap">
      {loading ? (
        <p className="desk-empty">Opening…</p>
      ) : error || !srcDoc ? (
        <p className="desk-empty">{error || "Could not open this."}</p>
      ) : (
        <iframe
          ref={iframeRef}
          className="app-frame"
          title={props.title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={srcDoc}
        />
      )}
    </div>
  );
}
