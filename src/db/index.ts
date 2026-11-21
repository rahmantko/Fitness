import "server-only";
import { createDb, migrateDb, type Db } from "./client";

const g = globalThis as unknown as { __db?: Promise<Db> };

/** One shared connection per server process (survives dev hot reloads). */
export function getDb(): Promise<Db> {
  if (!g.__db) {
    g.__db = createDb().then(async (db) => {
      // Applies any new migrations (and the starter food library) on startup, so a
      // fresh deploy needs no manual database setup. Already-applied ones are skipped.
      await migrateDb(db);
      return db;
    });
  }
  return g.__db;
}
