import * as z from "zod";

export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

/** Display name for the workspace default computer. */
export const DEFAULT_COMPUTER_NAME = "Default computer";

export const ActorType = z.enum(["human", "bot", "system"]);
export type ActorType = z.infer<typeof ActorType>;

export const ActorSchema = z.object({
  userId: Id,
  workspaceId: Id,
  email: z.string().email(),
  isDeploymentOwner: z.boolean(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const RunStatus = z.enum([
  "queued",
  "leased",
  "running",
  "waiting_input",
  "waiting_takeover",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const SandboxKind = z.enum(["docker", "e2b", "desktop", "fake"]);
export type SandboxKind = z.infer<typeof SandboxKind>;

export const MemoryScope = z.enum(["bot", "user", "workspace"]);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const ControlHolder = z.enum(["bot", "user", "none"]);
export type ControlHolder = z.infer<typeof ControlHolder>;

export const AvatarShape = z.enum([
  "circle",
  "squircle",
  "diamond",
  "triangle",
  "hex",
]);
export type AvatarShape = z.infer<typeof AvatarShape>;

/** Off = Groxbot’s own runtime. Other values are outbound guest agents. */
export const GuestKind = z.enum(["off", "hermes", "openclaw", "generic"]);
export type GuestKind = z.infer<typeof GuestKind>;

export const GuestAgentKind = z.enum(["hermes", "openclaw", "generic"]);
export type GuestAgentKind = z.infer<typeof GuestAgentKind>;

/** Workspace-owned document runtimes. Hidden source; UI is the thing. */
export const TemplateId = z.enum(["docs", "slides", "sheets"]);
export type TemplateId = z.infer<typeof TemplateId>;
