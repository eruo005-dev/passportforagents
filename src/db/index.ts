/**
 * Drizzle database client.
 *
 * Runtime queries go through the Supabase transaction pooler (DATABASE_URL,
 * port 6543). Transaction-mode pooling disallows prepared statements, hence
 * `prepare: false`. Migrations use DIRECT_URL (see drizzle.config.ts), not this.
 *
 * The postgres.js client is cached on globalThis so Next.js hot-reload in dev
 * doesn't exhaust the connection pool.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as unknown as {
  __agentPassportPg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__agentPassportPg ??
  postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__agentPassportPg = client;
}

export const db = drizzle(client, { schema });
export { schema };

/** Close the underlying connection pool. For scripts/tests so the process exits. */
export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
}
