import {
  parseOfficeAskArgs,
  parseOfficeAskResult,
  type OfficeAskOption,
  type OfficeAskQuestion,
} from "@groxbot/core/browser";
import { createContext, useContext, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radius } from "../theme";

export type OfficeAskActions = {
  answer: (toolCallId: string, answers: unknown) => Promise<void>;
  skip: (toolCallId: string) => Promise<void>;
};

export const OfficeAskActionsContext = createContext<OfficeAskActions | null>(
  null,
);

export function useOfficeAskActions(): OfficeAskActions | null {
  return useContext(OfficeAskActionsContext);
}

export function AskCard(props: {
  toolCallId?: string;
  args: unknown;
  result?: unknown;
}) {
  const questions = useMemo(() => parseOfficeAskArgs(props.args), [props.args]);
  const parsed = useMemo(
    () => parseOfficeAskResult(props.result),
    [props.result],
  );
  const actions = useOfficeAskActions();
  if (questions.length === 0 && !parsed) return null;
  return (
    <View style={styles.root} accessibilityLabel="Question">
      {parsed ? (
        <AskSettled result={parsed} />
      ) : (
        <AskForm
          questions={questions}
          disabled={!actions || !props.toolCallId}
          onSkip={() => {
            if (!props.toolCallId) return;
            void actions?.skip(props.toolCallId);
          }}
          onAnswer={(answers) => {
            if (!props.toolCallId) return;
            void actions?.answer(props.toolCallId, answers);
          }}
        />
      )}
    </View>
  );
}

function AskSettled(props: {
  result: NonNullable<ReturnType<typeof parseOfficeAskResult>>;
}) {
  if (props.result.skipped) {
    return <Text style={styles.muted}>You skipped — they’ll decide.</Text>;
  }
  const lines =
    props.result.answers.length > 0
      ? props.result.answers
      : props.result.message
        ? [{ id: "msg", prompt: "", value: props.result.message }]
        : [];
  return (
    <View style={styles.stack}>
      {lines.map((row) => (
        <Text key={row.id} style={styles.body}>
          {row.prompt ? `${row.prompt} ` : ""}
          {row.value}
        </Text>
      ))}
    </View>
  );
}

function AskForm(props: {
  questions: OfficeAskQuestion[];
  disabled: boolean;
  onSkip: () => void;
  onAnswer: (answers: unknown) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const locked = props.disabled || busy;
  const submit = (answers: unknown) => {
    if (locked) return;
    setBusy(true);
    props.onAnswer(answers);
  };
  const needsConfirm =
    props.questions.length > 1 ||
    props.questions.some((row) => row.multi || row.options.length === 0);
  return (
    <View style={styles.stack}>
      {props.questions.map((question) => (
        <AskQuestionBlock
          key={question.id}
          question={question}
          selected={picked[question.id] ?? []}
          draft={drafts[question.id] ?? ""}
          disabled={locked}
          onToggle={(option) => {
            if (!question.multi) {
              setPicked((current) => ({
                ...current,
                [question.id]: [option.id],
              }));
              if (props.questions.length === 1 && question.options.length) {
                submit({
                  answers: [{ id: question.id, selected: [option.id] }],
                });
              }
              return;
            }
            setPicked((current) => {
              const selected = current[question.id] ?? [];
              const has = selected.includes(option.id);
              return {
                ...current,
                [question.id]: has
                  ? selected.filter((id) => id !== option.id)
                  : [...selected, option.id],
              };
            });
          }}
          onDraft={(value) =>
            setDrafts((current) => ({ ...current, [question.id]: value }))
          }
          onFreeText={(value) =>
            submit({ answers: [{ id: question.id, text: value }] })
          }
        />
      ))}
      <View style={styles.row}>
        {needsConfirm ? (
          <Pressable
            disabled={locked}
            onPress={() =>
              submit({
                answers: props.questions.map((question) => ({
                  id: question.id,
                  selected: picked[question.id] ?? [],
                  text: drafts[question.id] ?? "",
                })),
              })
            }
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>Send answers</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={locked} onPress={() => {
          if (locked) return;
          setBusy(true);
          props.onSkip();
        }}>
          <Text style={styles.muted}>You decide</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AskQuestionBlock(props: {
  question: OfficeAskQuestion;
  selected: string[];
  draft: string;
  disabled: boolean;
  onToggle: (option: OfficeAskOption) => void;
  onDraft: (value: string) => void;
  onFreeText: (value: string) => void;
}) {
  const { question } = props;
  return (
    <View style={styles.stack}>
      <Text style={styles.prompt}>{question.prompt}</Text>
      {question.options.length > 0 ? (
        <View style={styles.wrap}>
          {question.options.map((option) => {
            const on = props.selected.includes(option.id);
            return (
              <Pressable
                key={option.id}
                disabled={props.disabled}
                onPress={() => props.onToggle(option)}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={on ? styles.primaryLabel : styles.body}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.row}>
          <TextInput
            value={props.draft}
            editable={!props.disabled}
            onChangeText={props.onDraft}
            placeholder="Type an answer"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={() => {
              const value = props.draft.trim();
              if (value) props.onFreeText(value);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  stack: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  prompt: { color: colors.text, fontSize: 14, fontWeight: "600" },
  body: { color: colors.text, fontSize: 13 },
  muted: { color: colors.muted, fontSize: 13 },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  primary: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  primaryLabel: { color: colors.bg, fontSize: 13, fontWeight: "600" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
});
