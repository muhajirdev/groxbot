import { Menu } from "@base-ui/react/menu";
import type { KnowledgeTask, KnowledgeTaskList } from "@groxbot/contracts";
import {
  appendTaskActivity,
  BOARD_VIEW_LABEL,
  BOARD_VIEWS,
  type BoardView,
  formatTaskMarkdown,
  groupTasksByStatus,
  parseTaskActivity,
  parseTaskStatus,
  slugFromTitle,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  type TaskStatus,
  taskFilePath,
  uniqueTaskName,
} from "@groxbot/core/browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type DragEvent, useMemo, useState } from "react";
import { readBoardView, writeBoardView } from "../lib/board-view";
import { userFacingError } from "../lib/errors";
import { OFFICE_MESSAGES_GC_TIME } from "../lib/office-messages";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { tenantBoundQueryFn } from "../lib/tenant-query";
import { formatListTime } from "../lib/time";
import { knowledgeListKey } from "../lib/workspace-catalog";
import { Button, cn, Textarea } from "../ui";
import { CreateTaskDialog } from "./CreateTaskDialog";
import {
  BoardIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ListIcon,
  PlusIcon,
} from "./Icons";
import { KnowledgeMarkdown } from "./KnowledgeFilePreview";

const TASK_DRAG = "application/x-groxbot-task";

const EMPTY_TASKS: KnowledgeTaskList = { tasks: [], truncated: false };

export const knowledgeTaskListKey =
  orpc.knowledge.listTasks.queryOptions().queryKey;

export function knowledgeTaskListQueryOptions() {
  return {
    ...orpc.knowledge.listTasks.queryOptions(),
    gcTime: OFFICE_MESSAGES_GC_TIME,
    queryFn: tenantBoundQueryFn(knowledgeTaskListKey, () =>
      client.knowledge.listTasks(),
    ),
  };
}

const menuItemClass = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink outline-none select-none",
  "data-highlighted:bg-hover",
);

export function TaskBoard(props: { author: string }) {
  const queryClient = useQueryClient();
  const listed = useQuery(knowledgeTaskListQueryOptions());
  const tasks = listed.data?.tasks ?? [];
  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const [view, setView] = useState(readBoardView);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [openName, setOpenName] = useState<string | null>(null);
  const open = tasks.find((row) => row.name === openName) ?? null;

  function setBoardView(next: BoardView) {
    setView(next);
    writeBoardView(next);
  }

  function peekList(): KnowledgeTaskList {
    return (
      queryClient.getQueryData<KnowledgeTaskList>(knowledgeTaskListKey) ?? {
        ...EMPTY_TASKS,
        tasks,
      }
    );
  }

  function patchList(next: KnowledgeTask[]) {
    queryClient.setQueryData<KnowledgeTaskList>(knowledgeTaskListKey, {
      tasks: next,
      truncated: peekList().truncated,
    });
  }

  async function refreshTasks(path?: string) {
    await queryClient.invalidateQueries({ queryKey: knowledgeTaskListKey });
    await queryClient.invalidateQueries({ queryKey: knowledgeListKey });
    if (path) {
      await queryClient.invalidateQueries({
        queryKey: orpc.knowledge.read.queryOptions({ input: { path } })
          .queryKey,
      });
    }
  }

  async function createTask(input: {
    title: string;
    body: string;
    status?: TaskStatus;
  }) {
    setCreateOpen(false);
    const taken = new Set(peekList().tasks.map((row) => row.name));
    const name = uniqueTaskName(slugFromTitle(input.title) || "task", taken);
    if (!name) return;
    const status = parseTaskStatus(input.status);
    const path = taskFilePath(name);
    const content = formatTaskMarkdown({
      name,
      description: input.title,
      status,
      body: input.body,
    });
    const row: KnowledgeTask = {
      name,
      description: input.title,
      status,
      path,
      directory: `tasks/${name}`,
      activityPath: `tasks/${name}/activity.md`,
      body: input.body,
    };
    patchList([...peekList().tasks, row]);
    setOpenName(name);
    try {
      await client.knowledge.write({ path, content });
      await refreshTasks(path);
    } catch (caught) {
      await refreshTasks();
      console.warn(userFacingError(caught, "Could not create that task"));
    }
  }

  async function setStatus(task: KnowledgeTask, status: TaskStatus) {
    if (parseTaskStatus(task.status) === status) return;
    const snapshot = peekList();
    patchList(
      snapshot.tasks.map((row) =>
        row.name === task.name ? { ...row, status } : row,
      ),
    );
    try {
      await client.knowledge.write({
        path: task.path,
        content: formatTaskMarkdown({
          name: task.name,
          description: task.description,
          status,
          body: task.body,
        }),
      });
      await refreshTasks(task.path);
    } catch (caught) {
      queryClient.setQueryData(knowledgeTaskListKey, snapshot);
      console.warn(userFacingError(caught, "Could not move that task"));
    }
  }

  function readDragId(event: DragEvent): string {
    return (
      event.dataTransfer.getData(TASK_DRAG) ||
      event.dataTransfer.getData("text/plain")
    ).trim();
  }

  function dropOn(status: TaskStatus, event: DragEvent) {
    event.preventDefault();
    setDropStatus(null);
    const name = readDragId(event);
    const task = tasks.find((row) => row.name === name);
    if (!task) return;
    void setStatus(task, status);
  }

  function dragStart(item: KnowledgeTask, event: DragEvent) {
    event.dataTransfer.setData(TASK_DRAG, item.name);
    event.dataTransfer.setData("text/plain", item.name);
    event.dataTransfer.effectAllowed = "move";
  }

  function openCreate(status?: TaskStatus) {
    setCreateStatus(status);
    setCreateOpen(true);
  }

  if (open) {
    return (
      <div className="room-board-wrap">
        <TaskDetail
          task={open}
          author={props.author}
          onBack={() => setOpenName(null)}
          onRefresh={() => void refreshTasks(open.activityPath)}
        />
        <CreateTaskDialog
          open={createOpen}
          status={createStatus}
          onClose={() => setCreateOpen(false)}
          onCreate={(input) => void createTask(input)}
        />
      </div>
    );
  }

  return (
    <div className="room-board-wrap">
      <div className="room-board-toolbar">
        <Button
          type="button"
          className="px-3 py-1.5 text-[13px]"
          onClick={() => openCreate()}
        >
          New task
        </Button>
        <DisplayMenu view={view} onView={setBoardView} />
      </div>
      {view === "list" ? (
        tasks.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
            <p className="m-0 text-[15px] font-semibold tracking-tight text-ink">
              No tasks yet
            </p>
            <p className="m-0 max-w-[36ch] text-center text-[13px] text-muted">
              Title is enough. Tasks live in the office library, not in a room.
            </p>
            <Button type="button" onClick={() => openCreate()}>
              New task
            </Button>
          </div>
        ) : (
          <div className="room-board-list">
            {TASK_STATUSES.map((status) => {
              const items = grouped[status];
              if (items.length === 0) return null;
              return (
                <section
                  key={status}
                  className="room-board-list-group"
                  aria-label={TASK_STATUS_LABEL[status]}
                >
                  <header className="room-board-col-head">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="room-board-status"
                        data-status={status}
                      />
                      <span>{TASK_STATUS_LABEL[status]}</span>
                      <span className="text-muted">{items.length}</span>
                    </span>
                  </header>
                  <div className="room-board-list-rows">
                    {items.map((item) => (
                      <ListRow
                        key={item.path}
                        item={item}
                        onOpen={() => setOpenName(item.name)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="room-board">
          {TASK_STATUSES.map((status) => (
            <section
              key={status}
              className={cn(
                "room-board-col",
                dropStatus === status && "is-drop",
              )}
              aria-label={TASK_STATUS_LABEL[status]}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropStatus !== status) setDropStatus(status);
              }}
              onDragLeave={() => {
                if (dropStatus === status) setDropStatus(null);
              }}
              onDrop={(event) => dropOn(status, event)}
            >
              <header className="room-board-col-head">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="room-board-status" data-status={status} />
                  <span>{TASK_STATUS_LABEL[status]}</span>
                  <span className="text-muted">{grouped[status].length}</span>
                </span>
                <button
                  className="room-board-col-add"
                  type="button"
                  aria-label={`New task in ${TASK_STATUS_LABEL[status]}`}
                  onClick={() => openCreate(status)}
                >
                  <PlusIcon />
                </button>
              </header>
              <div className="room-board-cards">
                {grouped[status].length === 0 ? (
                  <p className="room-board-empty">No tasks</p>
                ) : (
                  grouped[status].map((item) => (
                    <BoardCard
                      key={item.path}
                      item={item}
                      onOpen={() => setOpenName(item.name)}
                      onDragStart={(event) => dragStart(item, event)}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
      <CreateTaskDialog
        open={createOpen}
        status={createStatus}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => void createTask(input)}
      />
    </div>
  );
}

function TaskDetail(props: {
  task: KnowledgeTask;
  author: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const activityQuery = useQuery({
    queryKey: ["knowledge-task-activity", props.task.activityPath],
    queryFn: async () => {
      try {
        const file = await client.knowledge.read({
          path: props.task.activityPath,
        });
        const raw = typeof file.content === "string" ? file.content : "";
        return { raw, entries: parseTaskActivity(raw) };
      } catch {
        return { raw: "", entries: [] };
      }
    },
  });
  const entries = activityQuery.data?.entries ?? [];
  const raw = activityQuery.data?.raw ?? "";

  async function postComment() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const next = appendTaskActivity(raw, {
      at: new Date().toISOString(),
      author: props.author,
      body,
    });
    try {
      await client.knowledge.write({
        path: props.task.activityPath,
        content: next,
      });
      setDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-task-activity", props.task.activityPath],
      });
      await queryClient.invalidateQueries({ queryKey: knowledgeListKey });
      props.onRefresh();
    } catch (caught) {
      console.warn(userFacingError(caught, "Could not add that comment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="task-detail">
      <div className="task-detail-head">
        <Button
          variant="icon"
          type="button"
          aria-label="Back to board"
          onClick={props.onBack}
        >
          <ChevronLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[15px] font-semibold tracking-tight">
            {props.task.description}
          </strong>
          <span className="text-[12px] text-muted">
            {TASK_STATUS_LABEL[parseTaskStatus(props.task.status)]} ·{" "}
            {props.task.path}
          </span>
        </div>
      </div>
      <div className="task-detail-scroll">
        <section className="task-detail-section">
          {props.task.body.trim() ? (
            <KnowledgeMarkdown text={props.task.body} />
          ) : (
            <p className="m-0 text-[13px] text-muted">No notes yet.</p>
          )}
        </section>
        <section className="task-detail-section">
          <h3 className="m-0 text-[13px] font-semibold">Activity</h3>
          {entries.length === 0 ? (
            <p className="m-0 text-[13px] text-muted">
              Comments land in activity.md next to this task.
            </p>
          ) : (
            <ol className="task-activity">
              {entries.map((entry) => (
                <li
                  key={`${entry.at}:${entry.author}:${entry.body.slice(0, 24)}`}
                >
                  <div className="task-activity-meta">
                    <span className="font-medium text-ink">{entry.author}</span>
                    <span className="text-muted">
                      {formatListTime(entry.at)}
                    </span>
                  </div>
                  <KnowledgeMarkdown text={entry.body} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <form
        className="task-detail-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void postComment();
        }}
      >
        <Textarea
          value={draft}
          placeholder="Write a comment…"
          rows={3}
          maxLength={4000}
          aria-label="Comment"
          className="min-h-[72px]"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            className="px-3 py-1.5 text-[13px]"
            disabled={busy || !draft.trim()}
          >
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}

function DisplayMenu(props: {
  view: BoardView;
  onView: (view: BoardView) => void;
}) {
  const Icon = props.view === "list" ? ListIcon : BoardIcon;
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className="room-board-display"
        type="button"
        aria-label="Display"
      >
        <Icon />
        <span>{BOARD_VIEW_LABEL[props.view]}</span>
        <ChevronDownIcon />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          sideOffset={6}
          align="end"
        >
          <Menu.Popup className="popover-popup min-w-[168px] rounded-[10px] border border-line bg-card p-1 outline-none">
            {BOARD_VIEWS.map((id) => {
              const ItemIcon = id === "list" ? ListIcon : BoardIcon;
              return (
                <Menu.Item
                  key={id}
                  className={menuItemClass}
                  onClick={() => props.onView(id)}
                >
                  <ItemIcon className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    {BOARD_VIEW_LABEL[id]}
                  </span>
                  {props.view === id ? (
                    <CheckIcon className="size-3.5 shrink-0 text-muted" />
                  ) : null}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function BoardCard(props: {
  item: KnowledgeTask;
  onOpen: () => void;
  onDragStart: (event: DragEvent) => void;
}) {
  const item = props.item;
  const preview = item.body.trim();
  return (
    <button
      type="button"
      draggable
      onDragStart={props.onDragStart}
      onClick={props.onOpen}
      aria-label={item.description}
      className="room-board-card"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[14px] font-semibold">
          {item.description}
        </span>
      </span>
      {preview ? (
        <span className="line-clamp-2 text-[12px] text-muted">{preview}</span>
      ) : null}
    </button>
  );
}

function ListRow(props: { item: KnowledgeTask; onOpen: () => void }) {
  const item = props.item;
  const preview = item.body.trim();
  return (
    <button
      type="button"
      onClick={props.onOpen}
      aria-label={item.description}
      className="room-board-list-row"
    >
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">
          {item.description}
        </span>
        {preview ? (
          <span className="mt-0.5 line-clamp-1 text-[12px] text-muted">
            {preview}
          </span>
        ) : null}
      </span>
    </button>
  );
}
