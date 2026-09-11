/** Load office tasks from knowledge R2. Not a D1 `tasks` table. */

import type { KnowledgeTask, KnowledgeTaskList } from "@groxbot/contracts";
import { type KnowledgeDisk, sanitizeWorkspaceId } from "./knowledge.js";
import {
  isKnowledgeTaskFile,
  knowledgeTaskName,
  MAX_TASK_BYTES,
  MAX_WORKSPACE_TASKS,
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
  const tasks: KnowledgeTask[] = [];
  const seen = new Set<string>();
  let truncated = false;
  const paths = objects
    .map((object) =>
      object.key.startsWith(prefix) ? object.key.slice(prefix.length) : "",
    )
    .filter((path) => path && isKnowledgeTaskFile(path))
    .sort();
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
    tasks.push({
      name: parsed.name,
      description: parsed.description,
      status: parsed.status,
      path,
      directory,
      activityPath: taskActivityPath(parsed.name),
      body: parsed.body,
    });
  }
  return { tasks, truncated };
}
