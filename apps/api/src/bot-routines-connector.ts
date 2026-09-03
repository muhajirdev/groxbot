/** Cloudflare-only. Excluded from `tsc`. Recurring jobs as a Code Mode connector. */
import { CodemodeConnector, type ConnectorTools } from "@cloudflare/codemode";
import type { Routine } from "@groxbot/contracts";
import { RoutineError } from "@groxbot/core";

export type RoutineHost = {
  listRoutines(): Promise<Routine[]>;
  createRoutine(input: {
    name: string;
    prompt: string;
    cron: string;
    timezone?: string;
  }): Promise<Routine>;
  pauseRoutine(id: string): Promise<Routine>;
  resumeRoutine(id: string): Promise<Routine>;
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
      "This bot’s recurring jobs. Use when someone asks you to do something on a schedule.",
      "Schedules: “every day at 09:00”, “every weekday at 09:00”, “every week on monday at 09:00”, “every 30 minutes”.",
      "Timezone is IANA (default UTC). Pause or remove instead of stacking duplicates.",
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
          "Create a recurring job this bot will run even if nobody is in the office.",
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
      pause: {
        description: "Pause a routine so it stops firing until resumed.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        execute: async (args) =>
          this.host().pauseRoutine(stringArg(args, "id")),
      },
      resume: {
        description: "Resume a paused routine.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string", minLength: 1 } },
          required: ["id"],
        },
        execute: async (args) =>
          this.host().resumeRoutine(stringArg(args, "id")),
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
          const id = stringArg(args, "id");
          await this.host().removeRoutine(id);
          return { id };
        },
      },
    };
  }
}

function stringArg(args: unknown, key: string): string {
  const value = optionalStringArg(args, key);
  if (!value) throw new RoutineError();
  return value;
}

function optionalStringArg(args: unknown, key: string): string | undefined {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new RoutineError();
  }
  const value = (args as Record<string, unknown>)[key];
  if (value == null) return undefined;
  if (typeof value !== "string") throw new RoutineError();
  const trimmed = value.trim();
  return trimmed || undefined;
}
