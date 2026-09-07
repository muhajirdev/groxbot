import { useState } from "react";
import { planGateCopy } from "../lib/plan-gate";
import { userFacingError } from "../lib/errors";
import { client } from "../lib/rpc";
import { ModalShell } from "../ui";
import { CloseIcon } from "./Icons";
import { PlansCompare, type SubscribeCheckoutPlan } from "./PlansCompare";
import type { BillingInterval } from "../lib/plan-compare";

export function SubscribeModal(props: {
  open: boolean;
  trialAvailable: boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<SubscribeCheckoutPlan | null>(null);
  const [error, setError] = useState("");
  const copy = planGateCopy(props.trialAvailable);

  async function startCheckout(
    plan: SubscribeCheckoutPlan,
    interval: BillingInterval,
  ) {
    setBusy(plan);
    setError("");
    try {
      const result = await client.billing.checkout({ plan, interval });
      window.location.href = result.url;
    } catch (caught) {
      setError(userFacingError(caught, "Could not start checkout."));
      setBusy(null);
    }
  }

  return (
    <ModalShell
      open={props.open}
      wide
      className="subscribe-modal w-[min(920px,calc(100%-32px))] overflow-auto p-0"
      onClose={props.onClose}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="m-0 text-[22px] font-semibold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-1 mb-0 text-[13px] text-muted">{copy.body}</p>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label="Close"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="mx-5 mb-5">
        <PlansCompare
          trialAvailable={props.trialAvailable}
          busy={busy}
          error={error}
          onCheckout={(plan, interval) => void startCheckout(plan, interval)}
        />
      </div>
    </ModalShell>
  );
}
