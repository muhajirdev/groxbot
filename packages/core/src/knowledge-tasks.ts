/** Load office tasks from knowledge R2. Not a D1 `tasks` table. */

import type { KnowledgeTask, KnowledgeTaskList } from "@groxbot/contracts";
import { type KnowledgeDisk, sanitizeWorkspaceId } from "./knowledge.js";
import {
  isKnowledgeTaskFile,
  knowledgeTaskName,
  MAX_TASK_ACTIVITY_BYTES,
  MAX_TASK_BYTES,
  MAX_WORKSPACE_TASKS,
  parseTaskActivity,
  parseTaskMarkdown,
  TASK_FILE,
  taskActivityPath,
} from "./knowledge-task.js";

export async function listKnowledgeTasks(
  disk: KnowledgeDisk,
  workspaceId: string,
): Promise<KnowledgeTaskList> {
  const office = sanitizeWorkspaceId(workspaceId);
  const prefix = `${office}/`;
  const objects = await disk.list(prefix);
  const keys = new Set(
    objects
      .map((object) =>
        object.key.startsWith(prefix) ? object.key.slice(prefix.length) : "",
      )
      .filter(Boolean),
  );
  const tasks: KnowledgeTask[] = [];
  const seen = new Set<string>();
  let truncated = false;
  const paths = [...keys].filter((path) => isKnowledgeTaskFile(path)).sort();
  for (const path of paths) {
    if (tasks.length >= MAX_WORKSPACE_TASKS) {
      truncated = true;
      break;
    }
    const raw = await disk.getText(`${prefix}${path}`);
    if (!raw || raw.length > MAX_TASK_BYTES) continue;
    const parsed = parseTaskMarkdown(raw);
    if (!parsed || seen.has(parsed.name)) continue;
    const folderName = knowledgeTaskName(path);
    if (folderName && folderName !== parsed.name) continue;
    seen.add(parsed.name);
    const directory = path.endsWith(`/${TASK_FILE}`)
      ? path.slice(0, -`/${TASK_FILE}`.length)
      : "";
    const activityPath = taskActivityPath(parsed.name);
    const activityRaw = keys.has(activityPath)
      ? await disk.getText(`${prefix}${activityPath}`)
      : null;
    const activity =
      activityRaw && activityRaw.length <= MAX_TASK_ACTIVITY_BYTES
        ? parseTaskActivity(activityRaw).map((row) => ({
            at: row.at,
            author: row.author,
            ...(row.authorId ? { authorId: row.authorId } : {}),
          }))
        : [];
    tasks.push({
      name: parsed.name,
      description: parsed.description,
      status: parsed.status,
      path,
      directory,
      activityPath,
      body: parsed.body,
      ...(parsed.triggeredBy
        ? {
            triggeredBy: parsed.triggeredBy,
            triggeredByName: parsed.triggeredByName,
            triggeredAt: parsed.triggeredAt,
          }
        : {}),
      activity,
    });
  }
  return { tasks, truncated };
}
