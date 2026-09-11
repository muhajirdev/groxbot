import {
  officeApprovalCopy,
  type OfficePendingAction,
} from "@groxbot/core/browser";
import { Button } from "../ui";
import { useOfficeApprovalActions } from "../lib/office-approval-actions";

export function OfficeApprovalCard(props: {
  action: OfficePendingAction;
  resolving?: boolean;
}) {
  const copy = officeApprovalCopy(props.action);
  const actions = useOfficeApprovalActions();
  const locked = props.resolving || !actions;
  return (
    <div
      data-slot="office-approval"
      className="rounded-xl border border-line bg-card p-3 text-[13px]"
    >
      <p className="m-0 font-medium">{copy.title}</p>
      {copy.detail ? (
        <p className="mt-1 mb-0 text-muted-foreground">{copy.detail}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="tiny"
          disabled={locked}
          onClick={() => void actions?.reject(props.action)}
        >
          {copy.deny}
        </Button>
        <Button
          size="tiny"
          disabled={locked}
          onClick={() => void actions?.approve(props.action)}
        >
          {props.resolving ? `${copy.confirm}…` : copy.confirm}
        </Button>
      </div>
    </div>
  );
}
