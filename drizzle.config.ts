import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env (Next.js reads .env.local automatically, but drizzle-kit does not).
config({ path: ".env.local" });

const url = process.env.DIRECT_URL;
if (!url) {
  throw new Error("DIRECT_URL is not set (needed for migrations — the :5432 session connection)");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
