import Link from "next/link";
import { and, asc, desc, eq, ilike, isNotNull, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { Card, Empty, inputCls } from "@/components/ui";
import { Avatar } from "@/components/avatar";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const { q = "", role = "" } = await searchParams;
  const db = await getDb();
  const coach = alias(users, "coach");
  const where: SQL[] = [];
  const term = q.trim().slice(0, 80);
  if (term) where.push(or(ilike(users.name, `%${term}%`), ilike(users.email, `%${term}%`))!);
  if (role === "coach" || role === "client") where.push(eq(users.role, role));
  if (role === "suspended") where.push(isNotNull(users.suspendedAt));
  const rows = await db
    .select({ u: users, coachName: coach.name })
    .from(users)
    .leftJoin(coach, eq(users.coachId, coach.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(users.role), desc(users.createdAt))
    .limit(200);

  return (
    <>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={term} type="search" placeholder="Search name or email" aria-label="Search users" className={`${inputCls} min-w-[12rem] flex-1`} />
        <select name="role" defaultValue={role} aria-label="Filter" className={`${inputCls} w-auto`}>
          <option value="">Everyone</option>
          <option value="coach">Coaches</option>
          <option value="client">Clients</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text">Search</button>
      </form>
      <Card title={`${rows.length}${rows.length === 200 ? "+" : ""} ${rows.length === 1 ? "user" : "users"}`}>
        {rows.length === 0 ? (
          <Empty>No users match.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ u, coachName }) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 py-2.5 hover:text-accent">
                  <Avatar name={u.name} avatarKey={u.avatarKey} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className="capitalize">{u.role}</span>
                      {u.role === "client" && ` · ${coachName ? `coach: ${coachName}` : "no coach"}`} · joined{" "}
                      {u.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  {u.suspendedAt && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-danger">Suspended</span>}
                  {u.mustChangePassword && !u.suspendedAt && (
                    <span className="hidden shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted sm:inline">Temp password</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
