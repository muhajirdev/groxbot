import { MascotMark } from "@groxbot/mascot";
import { Link } from "@tanstack/react-router";
import { DEMOS, demoLogo } from "../lib/copy";

export type Demo = (typeof DEMOS)[number];

export function demoForUseCase(slug: string): Demo | undefined {
  return DEMOS.find(
    (demo) => "useCaseSlug" in demo && demo.useCaseSlug === slug,
  );
}

export function DemoThread(props: { demo: Demo; more?: boolean }) {
  const { demo, more = true } = props;
  return (
    <div className="demo-thread">
      <div className="demo-thread-head">
        <MascotMark
          name={demo.bot}
          color={demo.color}
          shape="circle"
          size="sm"
        />
        {demo.bot}
      </div>
      <div className="demo-thread-body">
        <p className="bubble human">{demo.prompt}</p>
        <ul className="tool-rows">
          {demo.actions.map((action) => (
            <li key={`${action.slug}-${action.call}`} className="tool-row">
              <img
                className="demo-logo"
                src={demoLogo(action.slug)}
                alt=""
                width={20}
                height={20}
              />
              <span className="tool-row-name">{action.name}</span>
              <code>{action.call}</code>
              <span className="tool-row-detail">{action.detail}</span>
            </li>
          ))}
        </ul>
        <p className="bubble bot">{demo.reply}</p>
      </div>
      <ComposerPlaceholder name={demo.bot} />
      {more ? (
        <p className="demo-more">
          {"useCaseSlug" in demo && demo.useCaseSlug ? (
            <Link to="/use-cases/$slug" params={{ slug: demo.useCaseSlug }}>
              See how this job works
            </Link>
          ) : "integrationSlug" in demo && demo.integrationSlug ? (
            <Link
              to="/integrations/$slug"
              params={{ slug: demo.integrationSlug }}
            >
              Open Google Drive
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function ComposerPlaceholder(props: { name: string }) {
  return (
    <div className="composer">
      <div className="composer-shell">
        <p className="composer-placeholder">Message {props.name}</p>
        <div className="composer-actions">
          <span className="composer-send" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Send</title>
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export function FirstMessageThread(props: {
  name: string;
  color?: string;
  prompt: string;
}) {
  return (
    <div className="demo-thread compact">
      <div className="demo-thread-head">
        <MascotMark
          name={props.name}
          color={props.color ?? "#e45c9a"}
          shape="circle"
          size="sm"
        />
        {props.name}
      </div>
      <div className="demo-thread-body">
        <p className="bubble human">{props.prompt}</p>
      </div>
      <ComposerPlaceholder name={props.name} />
    </div>
  );
}
