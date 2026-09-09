/** Cloudflare-only. Excluded from `tsc`. Recurring jobs as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import type { Routine } from "@groxbot/contracts";
import { connectorString, RoutineError } from "@groxbot/core";

export type RoutineHost = {
  listRoutines(): Promise<Routine[]>;
  createRoutine(input: {
    name: string;
    prompt: string;
    cron: string;
    timezone?: string;
  }): Promise<Routine>;
  updateRoutine(
    id: string,
    input: {
      name: string;
      prompt: string;
      cron: string;
      timezone?: string;
    },
  ): Promise<Routine>;
  pauseRoutine(id: string): Promise<Routine>;
  resumeRoutine(id: string): Promise<Routine>;
  runRoutine(id: string): Promise<void>;
  removeRoutine(id: string): Promise<void>;
};

export class RoutinesConnector extends CodemodeConnector {
  constructor(
    ctx: DurableObjectState,
    env: unknown,
    private readonly host: () => RoutineHost,
  ) {
    super(ctx, env as never);
  }

  override name() {
    return "routines";
  }

  protected override instructions() {
    return [
      "This bot’s recurring jobs. Create or edit only when a human asks to start or change a schedule.",
      "name is a short label, not the work. prompt is the job this bot will execute when the alarm fires.",
      "Schedules: “every day at 09:00”, “every weekday at 9:00 AM”, “every week on monday at 09:00”, “every 30 minutes”.",
      "Do not pass timezone unless they name a zone; the office clock is Settings → General.",
      "If this turn’s user message is a scheduled job firing (it starts with “Run now — scheduled job”), do that work. Do not call create, update, or run.",
    ].join(" ");
  }

  protected override tools(): ConnectorTools {
    return {
      list: {
        description: "List this bot’s routines and their next run.",
        inputSchema: { type: "object", properties: {} },
        replay: "reexecute",
        execute: async () => ({ routines: await this.host().listRoutines() }),
      },
      create: {
        description:
          "Create a recurring job this bot will run even if nobody is in the office. name is a short label. prompt is the work to do when it fires.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            schedule: { type: "string", minLength: 1, maxLength: 80 },
            timezone: { type: "string", maxLength: 80 },
          },
          required: ["name", "prompt", "schedule"],
        },
        execute: async (args) => {
          return this.host().createRoutine({
            name: stringArg(args, "name"),
            prompt: stringArg(args, "prompt"),
            cron: stringArg(args, "schedule"),
            timezone: optionalStringArg(args, "timezone"),
          });
        },
      },
      update: {
        description: "Change a routine’s name, prompt, or schedule.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            name: { type: "string", minLength: 1, maxLength: 80 },
            prompt: { type: "string", minLength: 1, maxLength: 8000 },
            schedule: { type: "string", minLength: 1, maxLength: 80 },
            timezone: { type: "string", maxLength: 80 },
          },
          required: ["id", "name", "prompt", "schedule"],
        },
        execute: async (args) =>
          this.host().updateRoutine(stringArg(args, "id", true), {
            name: stringArg(args, "name"),
            prompt: stringArg(args, "prompt"),
            cron: stringArg(args, "schedule"),
            timezone: optionalStringArg(args, "timezone"),
          }),
      },
      pause: {
        description: "Pause a routine so it stops firing until resumed.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        execute: async (args) =>
          this.host().pauseRoutine(stringArg(args, "id", true)),
      },
      resume: {
        description: "Resume a paused routine.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        execute: async (args) =>
          this.host().resumeRoutine(stringArg(args, "id", true)),
      },
      run: {
        description:
          "Run this routine now, without waiting for the next scheduled time.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        execute: async (args) => {
          await this.host().runRoutine(stringArg(args, "id", true));
          return { ok: true };
        },
      },
      remove: {
        description: "Delete a routine. Needs approval.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        requiresApproval: true,
        execute: async (args) => {
          const id = stringArg(args, "id", true);
          await this.host().removeRoutine(id);
          return { id };
        },
      },
    };
  }
}

function stringArg(args: unknown, key: string, positional = false): string {
  const value = optionalStringArg(args, key, positional);
  if (!value) throw new RoutineError();
  return value;
}

function optionalStringArg(
  args: unknown,
  key: string,
  positional = false,
): string | undefined {
  if (typeof args === "string") {
    return positional ? connectorString(args, key, true) : undefined;
  }
  return connectorString(args, key, false);
}
