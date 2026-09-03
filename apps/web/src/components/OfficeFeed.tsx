import { AvatarMark } from "./Avatar";
import { composioLogoUrl } from "../lib/plugins";

type Snip = {
  name: string;
  job: string;
  color: string;
  line: string;
  done?: boolean;
};

const SNIPS: Snip[] = [
  {
    name: "Scout",
    job: "Talent Scout",
    color: "#5b7cff",
    line: "Eight on the shortlist, with why. Nobody emailed.",
    done: true,
  },
  {
    name: "Ledger",
    job: "Expense Manager",
    color: "#2f9e6d",
    line: "Weekly summary from the sheet. Three receipts over policy. Nothing submitted.",
    done: true,
  },
  {
    name: "Repro",
    job: "Bug Reproduction",
    color: "#d9a441",
    line: "Same path in staging. Steps and screenshots in the thread.",
  },
];

export function OfficeFeed(_props: {
  youName?: string;
  youImage?: string | null;
}) {
  return (
    <div className="office-proof">
      <p className="thesis">There isn’t anything to learn.</p>
      <div className="office-thread">
        <div className="office-thread-head">
          <AvatarMark
            name="Outbound"
            color="#e45c9a"
            shape="circle"
            size="sm"
            mood="working"
          />
          Outbound
        </div>
        <div className="office-thread-body">
          <p className="bubble human">
            Pull this week’s prospect list from Salesforce. Skip anyone already
            in a sequence. Draft LinkedIn in my voice — don’t send.
          </p>
          <ul className="tool-rows">
            <li className="tool-row">
              <img
                className="demo-logo"
                src={composioLogoUrl("salesforce")}
                alt=""
                width={20}
                height={20}
              />
              <span className="tool-row-name">Salesforce</span>
              <code>get_list</code>
              <span className="tool-row-detail">Strategic Prospects</span>
            </li>
            <li className="tool-row">
              <img
                className="demo-logo"
                src={composioLogoUrl("linkedin")}
                alt=""
                width={20}
                height={20}
              />
              <span className="tool-row-name">LinkedIn</span>
              <code>create_post</code>
              <span className="tool-row-detail">parked for you</span>
            </li>
          </ul>
          <p className="bubble bot">
            Five accounts researched. Drafts are in the thread. Nothing sent.
          </p>
          <span className="status-pill">
            <i /> Working
          </span>
        </div>
      </div>
      <ul className="office-snips">
        {SNIPS.map((snip) => (
          <li key={snip.name} className="office-snip">
            <AvatarMark
              name={snip.name}
              color={snip.color}
              shape="circle"
              size="xs"
              mood={snip.done ? "happy" : "working"}
            />
            <div>
              <p className="office-snip-who">
                {snip.name}{" "}
                <span>{snip.job}</span>
              </p>
              <p className="office-snip-line">{snip.line}</p>
            </div>
            <span className={`status-pill${snip.done ? " done" : ""}`}>
              <i />
              {snip.done ? "Done" : "Working"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
