import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@/db/schema";
import { requireUser } from "./session";

/**
 * Admins are set with the ADMIN_EMAILS setting (comma separated), e.g. on Railway:
 * ADMIN_EMAILS=you@example.com. Nobody is an admin until it is set.
 */
export function isAdmin(user: Pick<User, "email"> | null | undefined) {
  if (!user) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}

/** The signed-in admin; anyone else gets a plain "not found". */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
