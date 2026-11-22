// Gives any account a temporary password (they must change it after logging in).
// For when a coach is locked out. On Railway: open the Fitness service, then the
// Console tab, and run:   npm run reset-password -- you@example.com
// Uses only production dependencies, so it works on the deployed server.
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { randomInt } from "node:crypto";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error("Usage: npm run reset-password -- someone@example.com");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this where the app runs (e.g. Railway's Console tab).");
  process.exit(1);
}

const words = ["apple", "bison", "cedar", "delta", "ember", "grape", "heron", "kite", "lemon", "mango", "olive", "pearl", "raven", "tiger", "zebra"];
const w = () => words[randomInt(words.length)];
const temp = `${w()}-${randomInt(1000, 10000)}-${w()}`;

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
try {
  const rows = await sql`
    update users set password_hash = ${await bcrypt.hash(temp, 10)}, must_change_password = true
    where lower(email) = ${email} returning name`;
  if (rows.length === 0) {
    console.error(`No account found for ${email}.`);
    process.exitCode = 1;
  } else {
    console.log(`Temporary password for ${rows[0].name} (${email}):\n\n  ${temp}\n\nLog in with it and you'll be asked to choose a new password.`);
  }
} finally {
  await sql.end();
}
