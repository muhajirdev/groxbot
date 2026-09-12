import type { KnowledgeTask } from "@groxbot/contracts";
import {
  appendTaskActivity,
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { userFacingError } from "../lib/errors";
import { orpc } from "../lib/orpc";
import { client } from "../lib/rpc";
import { formatListTime } from "../lib/time";
import type { RootStackParamList } from "../navigation";
import { colors, radius } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Board">;

export function BoardScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const listQuery = useQuery(orpc.knowledge.listTasks.queryOptions());
  const meQuery = useQuery(orpc.me.queryOptions());
  const tasks = listQuery.data?.tasks ?? [];
  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks]);
  const [openName, setOpenName] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const open = tasks.find((row) => row.name === openName) ?? null;
  const me = meQuery.data;
  const trigger = me?.userId
    ? { userId: me.userId, name: me.name.trim() || "Someone" }
    : undefined;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: orpc.knowledge.listTasks.key(),
    });
  }

  async function createTask() {
    const title = draftTitle.trim();
    if (!title) return;
    const taken = new Set(tasks.map((row) => row.name));
    const name = uniqueTaskName(slugFromTitle(title) || "task", taken);
    if (!name) return;
    try {
      await client.knowledge.write({
        path: taskFilePath(name),
        content: formatTaskMarkdown({
          name,
          description: title,
          status: createStatus,
          body: "",
          triggeredBy: trigger?.userId,
          triggeredByName: trigger?.name,
          triggeredAt: new Date().toISOString(),
        }),
      });
      setDraftTitle("");
      await refresh();
      setOpenName(name);
    } catch (caught) {
      console.warn(userFacingError(caught, "Could not create that task"));
    }
  }

  async function setStatus(task: KnowledgeTask, status: TaskStatus) {
    if (parseTaskStatus(task.status) === status) return;
    try {
      await client.knowledge.write({
        path: task.path,
        content: formatTaskMarkdown({
          name: task.name,
          description: task.description,
          status,
          body: task.body,
          triggeredBy: task.triggeredBy,
          triggeredByName: task.triggeredByName,
          triggeredAt: task.triggeredAt,
        }),
      });
      await refresh();
    } catch (caught) {
      console.warn(userFacingError(caught, "Could not move that task"));
    }
  }

  if (open) {
    return (
      <TaskDetailScreen
        task={open}
        author={trigger?.name ?? "you"}
        authorId={trigger?.userId}
        onBack={() => setOpenName(null)}
        onRefresh={() => void refresh()}
      />
    );
  }

  return (
    <Screen>
      <Header title="Board" onBack={() => navigation.navigate("Roster")} />
      {listQuery.isError ? (
        <Text style={styles.error}>Could not load tasks.</Text>
      ) : null}
      <View style={styles.compose}>
        <TextInput
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="New task title"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={() => void createTask()}
        />
      </View>
      <ScrollView
        horizontal
        style={styles.board}
        contentContainerStyle={styles.boardContent}
      >
        {TASK_STATUSES.map((status) => (
          <View key={status} style={styles.column}>
            <View style={styles.colHead}>
              <Text style={styles.colTitle}>{TASK_STATUS_LABEL[status]}</Text>
              <Pressable onPress={() => setCreateStatus(status)}>
                <Text style={styles.meta}>+</Text>
              </Pressable>
            </View>
            {(grouped[status] ?? []).map((task) => (
              <Pressable
                key={task.path}
                style={styles.card}
                onPress={() => setOpenName(task.name)}
                onLongPress={() => {
                  const next =
                    TASK_STATUSES[
                      (TASK_STATUSES.indexOf(parseTaskStatus(task.status)) +
                        1) %
                        TASK_STATUSES.length
                    ];
                  if (next) void setStatus(task, next);
                }}
              >
                <Text style={styles.name} numberOfLines={2}>
                  {task.description}
                </Text>
                {task.body.trim() ? (
                  <Text style={styles.preview} numberOfLines={2}>
                    {task.body.trim()}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function TaskDetailScreen(props: {
  task: KnowledgeTask;
  author: string;
  authorId?: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
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
  const queryClient = useQueryClient();
  const entries = activityQuery.data?.entries ?? [];
  const raw = activityQuery.data?.raw ?? "";

  async function post() {
    const body = draft.trim();
    if (!body) return;
    try {
      await client.knowledge.write({
        path: props.task.activityPath,
        content: appendTaskActivity(raw, {
          at: new Date().toISOString(),
          author: props.author,
          authorId: props.authorId,
          body,
        }),
      });
      setDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["knowledge-task-activity", props.task.activityPath],
      });
      props.onRefresh();
    } catch (caught) {
      console.warn(userFacingError(caught, "Could not add that comment"));
    }
  }

  return (
    <Screen>
      <Header title={props.task.description} onBack={props.onBack} />
      <ScrollView contentContainerStyle={styles.detail}>
        <Text style={styles.meta}>
          {TASK_STATUS_LABEL[parseTaskStatus(props.task.status)]} ·{" "}
          {props.task.path}
        </Text>
        <Text style={styles.body}>
          {props.task.body.trim() || "No notes yet."}
        </Text>
        <Text style={styles.colTitle}>Activity</Text>
        {entries.length === 0 ? (
          <Text style={styles.preview}>
            Comments land in activity.md next to this task.
          </Text>
        ) : (
          entries.map((entry) => (
            <View key={`${entry.at}:${entry.author}`} style={styles.comment}>
              <Text style={styles.meta}>
                {entry.author} · {formatListTime(entry.at)}
              </Text>
              <Text style={styles.body}>{entry.body}</Text>
            </View>
          ))
        )}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <Pressable onPress={() => void post()}>
          <Text style={styles.link}>Comment</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1 },
  boardContent: { padding: 12, gap: 12 },
  column: { width: 240, gap: 8 },
  colHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colTitle: { color: colors.text, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { color: colors.text, fontWeight: "600" },
  preview: { color: colors.muted, fontSize: 13 },
  link: { color: colors.text, fontWeight: "500" },
  meta: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, paddingHorizontal: 16 },
  compose: { paddingHorizontal: 12, paddingBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
    color: colors.text,
  },
  detail: { padding: 16, gap: 12 },
  body: { color: colors.text, fontSize: 15 },
  comment: { gap: 4 },
});
