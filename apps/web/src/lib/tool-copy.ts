export type ToolActivityKind =
  | "running"
  | "complete"
  | "cancelled"
  | "incomplete"
  | "requires-action";

const PHRASES: Record<string, { running: string; done: string }> = {
  set_context: {
    running: "Getting the desk ready",
    done: "Set up the desk",
  },
  code: {
    running: "Working in code",
    done: "Worked in code",
  },
  shell: {
    running: "Using the computer",
    done: "Used the computer",
  },
  list: { running: "Looking at files", done: "Looked at files" },
  read: { running: "Reading a file", done: "Read a file" },
  write: { running: "Writing a file", done: "Wrote a file" },
  edit: { running: "Editing a file", done: "Edited a file" },
  delete: { running: "Removing a file", done: "Removed a file" },
  find: { running: "Finding files", done: "Found files" },
  grep: { running: "Searching files", done: "Searched files" },
  publish: { running: "Publishing a file", done: "Published a file" },
  web_search: { running: "Searching the web", done: "Searched the web" },
  fetch_url: { running: "Reading a page", done: "Read a page" },
  to_markdown: {
    running: "Turning it into markdown",
    done: "Turned it into markdown",
  },
  render_pdf: {
    running: "Rendering a PDF",
    done: "Rendered a PDF",
  },
  render_screenshot: {
    running: "Taking a screenshot",
    done: "Took a screenshot",
  },
  present: { running: "Putting it on the page", done: "Put it on the page" },
  ask: { running: "Asking you", done: "Asked you" },
  skill_manage: { running: "Saving a playbook", done: "Saved a playbook" },
  room_list: { running: "Looking at papers", done: "Looked at papers" },
  room_read: { running: "Reading a paper", done: "Read a paper" },
  room_write: { running: "Writing a paper", done: "Wrote a paper" },
};

function fromSlug(name: string): string {
  const text = name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return "Working on it";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function stopped(running: string): string {
  return `Stopped ${running.toLowerCase()}`;
}

/** One short line for a tool row. Not a debug `Used tool: name`. */
export function toolActivityCopy(
  name: string,
  kind: ToolActivityKind,
): string {
  const key = name.trim();
  const known = PHRASES[key];
  if (known) {
    if (kind === "cancelled") return stopped(known.running);
    if (kind === "running" || kind === "requires-action") return known.running;
    return known.done;
  }
  const fallback = fromSlug(key);
  if (kind === "cancelled") return stopped(fallback);
  return fallback;
}
