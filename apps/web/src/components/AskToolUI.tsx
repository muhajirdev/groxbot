import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  OFFICE_ASK_TOOL_NAME,
  parseOfficeAskArgs,
  parseOfficeAskResult,
  type OfficeAskOption,
  type OfficeAskQuestion,
} from "@groxbot/core/browser";
import { useMemo, useState, type ReactNode } from "react";
import { useOfficeAskActions } from "../lib/office-ask-actions";
import { Button, cn } from "../ui";

export function AskSurface(props: {
  toolCallId?: string;
  args: unknown;
  result?: unknown;
  running?: boolean;
}): ReactNode {
  const questions = useMemo(() => parseOfficeAskArgs(props.args), [props.args]);
  const actions = useOfficeAskActions();
  const parsed = useMemo(
    () => parseOfficeAskResult(props.result),
    [props.result],
  );
  if (questions.length === 0 && !parsed) return null;
  return (
    <div
      data-slot="office-ask"
      data-waiting={props.running ? "" : undefined}
      className="rounded-xl border border-line bg-card p-3 text-[13px]"
    >
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
    </div>
  );
}

function AskSettled(props: {
  result: NonNullable<ReturnType<typeof parseOfficeAskResult>>;
}) {
  if (props.result.skipped) {
    return (
      <p className="text-muted-foreground m-0">
        You skipped — they’ll decide.
      </p>
    );
  }
  const lines =
    props.result.answers.length > 0
      ? props.result.answers
      : props.result.message
        ? [{ id: "msg", prompt: "", value: props.result.message }]
        : [];
  return (
    <div className="flex flex-col gap-2">
      {lines.map((row) => (
        <p key={row.id} className="m-0">
          {row.prompt ? (
            <span className="text-muted-foreground">{row.prompt} </span>
          ) : null}
          <span>{row.value}</span>
        </p>
      ))}
    </div>
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

  return (
    <div className="flex flex-col gap-3">
      {props.questions.map((question) => (
        <AskQuestionBlock
          key={question.id}
          question={question}
          selected={picked[question.id] ?? []}
          draft={drafts[question.id] ?? ""}
          disabled={locked}
          onToggle={(option) => {
            if (!question.multi) {
              setPicked((current) => ({ ...current, [question.id]: [option.id] }));
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
      <div className="flex flex-wrap items-center gap-2">
        {needsConfirm(props.questions) ? (
          <Button
            size="tiny"
            disabled={locked || !canConfirm(props.questions, picked, drafts)}
            onClick={() =>
              submit({
                answers: props.questions.map((question) => ({
                  id: question.id,
                  selected: picked[question.id] ?? [],
                  text: drafts[question.id] ?? "",
                })),
              })
            }
          >
            Send answers
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="tiny"
          disabled={locked}
          onClick={() => {
            if (locked) return;
            setBusy(true);
            props.onSkip();
          }}
        >
          You decide
        </Button>
      </div>
    </div>
  );
}

function needsConfirm(questions: OfficeAskQuestion[]): boolean {
  if (questions.length > 1) return true;
  return questions.some((row) => row.multi || row.options.length === 0);
}

function canConfirm(
  questions: OfficeAskQuestion[],
  picked: Record<string, string[]>,
  drafts: Record<string, string>,
): boolean {
  return questions.every((question) => {
    const selected = picked[question.id] ?? [];
    const text = drafts[question.id]?.trim() ?? "";
    if (question.options.length === 0) return Boolean(text);
    return selected.length > 0 || Boolean(text);
  });
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
    <div className="flex flex-col gap-2">
      <p className="m-0 font-medium">{question.prompt}</p>
      {question.options.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => {
            const on = props.selected.includes(option.id);
            return (
              <Button
                key={option.id}
                type="button"
                variant={on ? "solid" : "ghost"}
                size="tiny"
                disabled={props.disabled}
                on={on}
                onClick={() => props.onToggle(option)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = props.draft.trim();
            if (!value) return;
            props.onFreeText(value);
          }}
        >
          <input
            value={props.draft}
            disabled={props.disabled}
            onChange={(event) => props.onDraft(event.target.value)}
            placeholder="Type an answer"
            className={cn(
              "min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent",
            )}
          />
          <Button size="tiny" type="submit" disabled={props.disabled}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}

export const AskToolUI = makeAssistantToolUI({
  toolName: OFFICE_ASK_TOOL_NAME,
  display: "standalone",
  render: ({ args, result, status, toolCallId }) => (
    <AskSurface
      toolCallId={toolCallId}
      args={args}
      result={result}
      running={status?.type === "running" || status?.type === "requires-action"}
    />
  ),
});
