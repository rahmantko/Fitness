import path from "node:path";
import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Uses Postgres when DATABASE_URL is set (e.g. Supabase in production),
 * otherwise an embedded Postgres (PGlite) stored in ./data/pglite for local dev.
 */
export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    return drizzle(postgres(url, { prepare: false }), { schema }) as unknown as Db;
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_EMBEDDED_DB !== "1") {
    // The embedded database is for local development only: it is slow to start,
    // memory-hungry, and would lose data on hosts without a persistent disk.
    throw new Error(
      "DATABASE_URL is not set. Add it to the app's environment variables (on Railway: ${{Postgres.DATABASE_URL}}).",
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = path.join(process.cwd(), "data", "pglite");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  return drizzle(new PGlite(dir), { schema }) as unknown as Db;
}

export async function migrateDb(db: Db) {
  await runMigrations(db);
  const { seedFoodLibrary } = await import("./food-library");
  await seedFoodLibrary(db);
}

async function runMigrations(db: Db) {
  const folder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: folder });
  }
}
