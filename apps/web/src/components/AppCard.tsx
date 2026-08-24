import type { TemplateId } from "@groxbot/contracts";
import { APP_KIND_LABEL } from "../lib/app-kind";

export function AppCard(props: {
  templateId: TemplateId;
  title: string;
  onOpen: () => void;
}) {
  return (
    <div className="computer-card app-card">
      <div className="computer-card-head">
        <span>{APP_KIND_LABEL[props.templateId]}</span>
      </div>
      <p className="computer-task">{props.title}</p>
      <button className="open-computer" type="button" onClick={props.onOpen}>
        Open
      </button>
    </div>
  );
}
