import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_KIND_LABEL } from "../lib/app-kind";
import { appSrcDoc } from "../lib/app-srcdoc";
import { client } from "../lib/rpc";
import { CloseIcon } from "./Icons";

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
  const bundleQuery = useQuery({
    queryKey: ["app-bundle", props.appId],
    queryFn: () => client.apps.uiBundle({ appId: props.appId }),
    staleTime: 60_000,
  });
  const srcDoc = useMemo(() => {
    const js = bundleQuery.data?.jsCode;
    return js ? appSrcDoc(js) : "";
  }, [bundleQuery.data?.jsCode]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    void srcDoc;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as {
        type?: string;
        id?: number;
        method?: string;
        args?: unknown[];
      };
      if (data?.type !== "gadget:call" || data.id == null) return;
      const method = data.method ?? "";
      void client.apps
        .call({
          appId: props.appId,
          method,
          args: data.args ?? [],
        })
        .then((result) => {
          iframe.contentWindow?.postMessage(
            { type: "gadget:result", id: data.id, result },
            "*",
          );
        })
        .catch((caught: unknown) => {
          const message =
            caught instanceof Error ? caught.message : "Could not save";
          setError(message);
          iframe.contentWindow?.postMessage(
            { type: "gadget:result", id: data.id, error: message },
            "*",
          );
        });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [props.appId, srcDoc]);

  return (
    <div className="app-frame-wrap">
      {bundleQuery.isPending ? (
        <p className="desk-empty">Opening…</p>
      ) : bundleQuery.error || !srcDoc ? (
        <p className="desk-empty">Could not open this.</p>
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
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
