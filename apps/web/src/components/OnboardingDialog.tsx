import { useId, useState } from "react";
import {
  FOUNDER_EMAIL,
  FOUNDER_IMAGE,
  FOUNDER_NAME,
  ONBOARDING_VIDEO_SRC,
  onboardingFirstName,
} from "../lib/onboarding";
import { planGateCopy } from "../lib/plan-gate";
import type { OfficeColorId } from "../lib/office-color";
import { ModalShell } from "../ui";
import { CloseIcon } from "./Icons";
import { OfficeColorPicker } from "./OfficeColorPicker";
import { PersonAvatar } from "./PersonAvatar";
import { ScheduleDemoButton } from "./ScheduleDemoButton";

export function OnboardingVideo(props: { className?: string }) {
  const [ok, setOk] = useState(true);

  if (!ok) {
    return <div className={props.className} aria-hidden />;
  }

  return (
    <video
      className={props.className}
      src={ONBOARDING_VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      onError={() => setOk(false)}
    />
  );
}

export function OnboardingWelcome(props: {
  youName?: string | null;
  youEmail?: string | null;
  officeColor?: OfficeColorId;
  onOfficeColor?: (id: OfficeColorId) => void;
  continueLabel?: string;
  onContinue: () => void;
  onClose?: () => void;
}) {
  const firstName = onboardingFirstName({
    name: props.youName,
    email: props.youEmail,
  });

  return (
    <div className="onboard-welcome">
      <div className="onboard-head">
        <h2>A note from {FOUNDER_NAME}</h2>
        <button
          className="icon-btn"
          type="button"
          aria-label="Close"
          onClick={props.onClose ?? props.onContinue}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="onboard-body">
        <div className="onboard-from">
          <PersonAvatar
            name={FOUNDER_NAME}
            image={FOUNDER_IMAGE}
            size="md"
            className="onboard-from-photo"
          />
          <p className="onboard-from-name">{FOUNDER_NAME}</p>
          <p className="onboard-from-note">Founder</p>
        </div>
        <div className="onboard-letter">
          <p className="onboard-hello">
            Hey
            {firstName ? (
              <>
                {" "}
                <mark className="onboard-you">{firstName}</mark>
              </>
            ) : null}
            ,
          </p>
          <p>
            I used to spend my day passing work between the AI and my
            colleagues.
          </p>
          <p>
            I'd do the work with the AI. A question, a PDF, a presentation, a
            website. Then I'd send it over. “Look at this.” Then they'd write
            back. “Can you change this?” So I'd do it again.
          </p>
          <p>
            I was in the middle. They weren't.
          </p>
          <p>
            I wanted us in the same place. Us and the AI. Working together, not
            through me. They could watch how I work with it. That's how a team
            starts using AI. Not from a class. From seeing it.
          </p>
          <p>
            I also wanted an AI that gets smarter as we work. We do something.
            It remembers. Next week is easier. We don't start over.
          </p>
          <p>
            I hope you get that here. You, the people around you, and the AI. In
            one office.
          </p>
          <div className="onboard-signoff">
            <FounderSignature />
            <strong>{FOUNDER_NAME}</strong>
          </div>
          <div className="onboard-ps">
            <p>
              P.S. If something's off, write me —{" "}
              <a href={`mailto:${FOUNDER_EMAIL}`}>{FOUNDER_EMAIL}</a>. I read it.
            </p>
            <p>This place is yours. Pick a color that feels like you.</p>
            <OfficeColorPicker
              value={props.officeColor}
              onChange={props.onOfficeColor}
            />
          </div>
          <div className="onboard-actions">
            <button className="onboard-go" type="button" onClick={props.onContinue}>
              {props.continueLabel ?? "OK, let's see my office"}
            </button>
            <ScheduleDemoButton className="onboard-demo" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ink scribble — not a script font. Swap for a scan later. */
function FounderSignature() {
  const inkId = `onboard-ink-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className="onboard-signature"
      viewBox="0 0 300 96"
      fill="none"
      aria-hidden
    >
      <defs>
        <filter id={inkId} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.35"
            numOctaves="2"
            seed="11"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.15"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g
        filter={`url(#${inkId})`}
        transform="rotate(-7 24 58)"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M16 62c4-36 10-48 14-10 3 26 7-32 12-6 4 18 8-28 12 4 3-34 9-14 12 22 2 20 8-10 15 2 8-20 15 36 20 12 4-16 10-6 13 8 6-22 14-16 18 6 8-18 14 4 20 16 28-24 62 10 98-14"
          strokeWidth="2.05"
        />
        <path
          d="M24 66c78-12 154 18 242-20"
          strokeWidth="1.35"
        />
        <circle cx="176" cy="24" r="1.85" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

export function OnboardingDialog(props: {
  open: boolean;
  youName?: string | null;
  youEmail?: string | null;
  officeColor?: OfficeColorId;
  onOfficeColor?: (id: OfficeColorId) => void;
  needsPlan?: boolean;
  trialAvailable?: boolean;
  onDismiss: () => void;
  onContinue: () => void;
}) {
  const needsPlan = props.needsPlan !== false;
  const copy = planGateCopy(props.trialAvailable !== false);

  return (
    <ModalShell
      open={props.open}
      className="onboard-dialog overflow-hidden p-0"
      onClose={props.onDismiss}
    >
      <OnboardingWelcome
        youName={props.youName}
        youEmail={props.youEmail}
        officeColor={props.officeColor}
        onOfficeColor={props.onOfficeColor}
        continueLabel={needsPlan ? copy.cta : "OK, let's see my office"}
        onContinue={props.onContinue}
        onClose={props.onDismiss}
      />
    </ModalShell>
  );
}
