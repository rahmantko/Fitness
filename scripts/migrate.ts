import { createDb, migrateDb } from "../src/db/client";

async function main() {
  const db = await createDb();
  await migrateDb(db);
  console.log("Migrations applied.");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
