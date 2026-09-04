/**
 * Browser-safe Pi transcript + projection. Vite evaluates `export *` on the
 * main `@groxbot/core` barrel, which pulls Node and Drizzle modules into the
 * SPA. Clients import this entry instead.
 */
export * from "./office-chat.js";
export * from "./pi-projection.js";
export * from "./pi-transcript.js";
export * from "./routine-clock.js";
export * from "./room-speaker.js";
export * from "./room-target.js";
export * from "./sidebar-roster.js";
