/** Cloudflare-only. Group RoomActor calls a person’s home instance. */
import { OFFICE_WORKSPACE_HEADER } from "@groxbot/core";
import {
  parsePersonDoorContext,
  parsePersonDoorToolSpecs,
  PERSON_DOOR_CONTEXT_PATH,
  PERSON_DOOR_TOOL_PATH,
  PERSON_DOOR_TOOLS_PATH,
  type PersonDoorContext,
  type PersonDoorToolSpec,
} from "@groxbot/core";
import { getAgentByName } from "agents";

type RoomNamespace = DurableObjectNamespace;

async function personDoor(
  ns: RoomNamespace,
  homeRoomId: string,
  workspaceId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const stub = await getAgentByName(ns, homeRoomId);
  const response = await stub.fetch(
    new Request(`https://groxbot.internal${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [OFFICE_WORKSPACE_HEADER]: workspaceId,
      },
      body: JSON.stringify(body),
    }),
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `person door ${path} ${response.status}`);
  }
  return response.json();
}

export async function personDoorContext(
  ns: RoomNamespace,
  homeRoomId: string,
  workspaceId: string,
): Promise<PersonDoorContext> {
  const parsed = parsePersonDoorContext(
    await personDoor(ns, homeRoomId, workspaceId, PERSON_DOOR_CONTEXT_PATH, {
      op: "get",
    }),
  );
  if (!parsed) throw new Error("Person door returned no soul.");
  return parsed;
}

export async function personDoorTools(
  ns: RoomNamespace,
  homeRoomId: string,
  workspaceId: string,
): Promise<PersonDoorToolSpec[]> {
  return parsePersonDoorToolSpecs(
    await personDoor(ns, homeRoomId, workspaceId, PERSON_DOOR_TOOLS_PATH, {}),
  );
}

export async function personDoorTool(
  ns: RoomNamespace,
  homeRoomId: string,
  workspaceId: string,
  input: { name: string; params: unknown; toolCallId: string },
): Promise<unknown> {
  return personDoor(ns, homeRoomId, workspaceId, PERSON_DOOR_TOOL_PATH, input);
}
