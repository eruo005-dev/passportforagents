/**
 * Security: enable Row-Level Security on every public table.
 *
 * Supabase auto-exposes all `public` tables over its PostgREST API to the
 * `anon` / `authenticated` roles. This app never uses that API — it talks to
 * Postgres directly via Drizzle as the `postgres` role, which owns the tables
 * and BYPASSES RLS. Enabling RLS with NO policies therefore blocks the public
 * REST roles entirely while the app keeps full access. Idempotent — safe to
 * re-run, and MUST be run after any migration that creates a new table.
 *
 *   npx tsx --env-file=.env.local scripts/enable-rls.mts
 */
import postgres from "postgres";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL not set");

const sql = postgres(url, { prepare: false, max: 1 });
try {
  const tables = await sql`
    SELECT relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'`;
  for (const { relname } of tables) {
    await sql.unsafe(`ALTER TABLE public."${relname}" ENABLE ROW LEVEL SECURITY;`);
    await sql.unsafe(`REVOKE ALL ON public."${relname}" FROM anon, authenticated;`);
    console.log("✓ RLS enabled + grants revoked:", relname);
  }
  const missing = await sql`
    SELECT relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false`;
  console.log(
    missing.length === 0
      ? "\nAll public tables RLS-enabled."
      : `\n⚠ STILL WITHOUT RLS: ${missing.map((r) => r.relname).join(", ")}`,
  );
} finally {
  await sql.end();
}
