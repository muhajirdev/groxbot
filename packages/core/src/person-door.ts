import { composeSoul } from "./soul.js";

/** Home RoomActor HTTP paths other rooms call for that person’s state. */
export const PERSON_DOOR_CONTEXT_PATH = "/door/context";
export const PERSON_DOOR_TOOLS_PATH = "/door/tools";
export const PERSON_DOOR_TOOL_PATH = "/door/tool";

export type PersonDoorContext = {
  soulPrompt: string;
  overlay: string;
  memory: string;
};

export type PersonDoorToolSpec = {
  name: string;
  description: string;
  parameters: unknown;
};

export function composePersonDoorSoul(ctx: PersonDoorContext): string {
  let soul = composeSoul(ctx.soulPrompt, ctx.overlay);
  const memory = ctx.memory.trim();
  if (memory) soul = `${soul}\n\nMemory:\n${memory}`;
  return soul;
}

export function parsePersonDoorContext(value: unknown): PersonDoorContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.soulPrompt !== "string") return null;
  return {
    soulPrompt: row.soulPrompt,
    overlay: typeof row.overlay === "string" ? row.overlay : "",
    memory: typeof row.memory === "string" ? row.memory : "",
  };
}

export function parsePersonDoorToolSpecs(value: unknown): PersonDoorToolSpec[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const tools = (value as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return [];
  return tools.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) return [];
    return [
      {
        name,
        description:
          typeof row.description === "string" && row.description
            ? row.description
            : name,
        parameters: row.parameters,
      },
    ];
  });
}
