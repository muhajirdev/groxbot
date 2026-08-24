import { MonitorIcon } from "./Icons";

export function ComputerCard(props: {
  title: string;
  status: string;
  done?: boolean;
  preview?: string;
  onOpen: () => void;
}) {
  return (
    <div className="computer-card">
      <div className="computer-card-head">
        <span>Computer</span>
        <span className={`status-pill${props.done ? " done" : ""}`}>
          <i />
          {props.status}
        </span>
      </div>
      {props.preview ? (
        <div className="computer-thumb">{props.preview}</div>
      ) : null}
      <p className="computer-task">{props.title}</p>
      <button className="open-computer" type="button" onClick={props.onOpen}>
        <MonitorIcon />
        Open computer
      </button>
    </div>
  );
}
