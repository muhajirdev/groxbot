import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
if (existsSync(rootEnv) && !process.env.DATABASE_PATH) {
  process.loadEnvFile(rootEnv);
}

const sqliteFile =
  process.env.DATABASE_PATH ??
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/groxbot.sqlite",
  );

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteFile.startsWith("file:") ? sqliteFile : `file:${sqliteFile}`,
  },
});
