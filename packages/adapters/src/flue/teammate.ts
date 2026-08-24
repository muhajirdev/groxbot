"use agent";

import { useInstruction, useModel, useTool } from "@flue/runtime";
import * as v from "valibot";
import { peekTeammateTurn } from "./context.js";
import { ECHO_MODEL } from "./echo.js";
import { useComposio } from "./tools.js";

/**
 * One Groxbot teammate type. Instances are `botId`, not new modules.
 * Instructions and model come from the host process for this turn.
 * Flue is not the v1 product loop.
 */
export function Teammate(props: { id: string }) {
  const turn = peekTeammateTurn(props.id);
  useModel(turn?.model ?? ECHO_MODEL);
  if (turn?.instructions) useInstruction(turn.instructions);
  usePoke(props.id, turn);
  useComposio(props.id);
  return "You are a Groxbot teammate in an office thread. Be concise and useful. The human talks primarily to you. If another teammate must do a slice of work, poke them and bring their reply back here. Do not send the human to their office. Connected plugins are available via composio_search and composio_execute. Draft mail, events, issues, and PRs; do not send, pay, merge, or delete unless the human clearly asked.";
}

function usePoke(
  instanceId: string,
  turn:
    | {
        teammates?: Array<{ id: string; name: string; title: string }>;
        poke?: (name: string, message: string) => Promise<string>;
      }
    | undefined,
) {
  const teammates = turn?.teammates ?? [];
  if (!turn?.poke || teammates.length === 0) return;
  const roster = teammates
    .map((item) =>
      item.title.trim() ? `${item.name} (${item.title})` : item.name,
    )
    .join(", ");
  useTool({
    name: "poke_teammate",
    description: `Send a task to another teammate and wait for their reply. The human stays in this thread. Available: ${roster}.`,
    input: v.object({
      name: v.pipe(v.string(), v.minLength(1)),
      message: v.pipe(v.string(), v.minLength(1)),
    }),
    run: async (ctx) => {
      const current = peekTeammateTurn(instanceId);
      if (!current?.poke) return "Poke is not available on this turn.";
      try {
        const reply = await current.poke(ctx.data.name, ctx.data.message);
        return `${ctx.data.name} replied:\n${reply}`;
      } catch (error) {
        return error instanceof Error ? error.message : "Poke failed.";
      }
    },
  });
}

Teammate.agentName = "teammate";
