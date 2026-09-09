import type { SkillsStoreDetail, SkillsStoreListing } from "@groxbot/contracts";
import { useEffect, useState } from "react";
import { userFacingError } from "../lib/errors";
import { client } from "../lib/rpc";
import { skillsStoreTrustLabel } from "../lib/skills-store";
import { Button } from "../ui";
import { ChatMarkdown } from "./ChatMarkdown";
import { CheckIcon, FileKindIcon } from "./Icons";

export function SkillStoreDetailView(props: {
  listing: SkillsStoreListing;
  onBack: () => void;
  onInstall: (listing: SkillsStoreListing) => void;
  busy?: boolean;
  installed?: boolean;
}) {
  const [detail, setDetail] = useState<SkillsStoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    client.knowledge
      .readSkill({ id: props.listing.id, source: props.listing.source })
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(userFacingError(caught, "Could not load skill details."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [props.listing.id, props.listing.source]);

  const trustLabel = skillsStoreTrustLabel(props.listing.trust);
  const upstreamUrl =
    props.listing.homepage ||
    (props.listing.source.startsWith("http")
      ? props.listing.source
      : `https://github.com/${props.listing.source}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <button
          type="button"
          className="m-0 flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-medium text-muted hover:text-ink"
          onClick={props.onBack}
        >
          ← Back to skills
        </button>
        <div className="flex items-center gap-2">
          {upstreamUrl ? (
            <a
              href={upstreamUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[12px] text-muted hover:text-ink hover:underline"
            >
              Source
            </a>
          ) : null}
          {props.installed ? (
            <span className="flex items-center gap-1 text-[13px] font-medium text-ok">
              <CheckIcon className="size-4" /> Added
            </span>
          ) : (
            <Button
              className="mini"
              disabled={props.busy || loading}
              onClick={() => props.onInstall(props.listing)}
            >
              {props.busy ? "Installing…" : "Install"}
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-[18px] font-semibold tracking-tight text-ink">
                {props.listing.name}
              </h2>
              <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                {trustLabel}
              </span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                {props.listing.category}
              </span>
            </div>
            <p className="m-0 text-[13px] text-muted">
              {detail?.description || props.listing.blurb}
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[13px] text-muted">
              Loading skill instructions…
            </div>
          ) : error ? (
            <div className="rounded-[10px] border border-danger/20 bg-danger/5 p-4 text-center">
              <p className="m-0 mb-2 text-[13px] text-danger">{error}</p>
              <Button
                variant="ghost"
                className="text-[12px]"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  client.knowledge
                    .readSkill({
                      id: props.listing.id,
                      source: props.listing.source,
                    })
                    .then(setDetail)
                    .catch((c) =>
                      setError(
                        userFacingError(c, "Could not load skill details."),
                      ),
                    )
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : detail ? (
            <div className="flex flex-col gap-5">
              {detail.resources && detail.resources.length > 0 ? (
                <div className="rounded-[12px] border border-line bg-card-2 p-3">
                  <span className="mb-2 block text-[11px] font-semibold tracking-wider text-muted uppercase">
                    Included files ({detail.resources.length})
                  </span>
                  <ul className="m-0 flex flex-col gap-1.5 p-0 list-none text-[12px]">
                    {detail.resources.map((res) => (
                      <li
                        key={res.path}
                        className="flex items-center gap-2 font-mono text-muted"
                      >
                        <FileKindIcon
                          name={res.path}
                          className="size-3.5 shrink-0"
                        />
                        <span className="truncate">{res.path}</span>
                        <span className="rounded bg-card px-1.5 py-0.2 text-[10px] text-muted">
                          {res.kind}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-[14px] border border-line bg-card p-4 sm:p-5">
                <span className="mb-3 block text-[11px] font-semibold tracking-wider text-muted uppercase">
                  Playbook Instructions
                </span>
                <div className="prose prose-sm max-w-none text-[13px] text-ink leading-relaxed">
                  <ChatMarkdown text={detail.content} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
