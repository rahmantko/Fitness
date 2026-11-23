import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, desc, eq, max } from "drizzle-orm";
import { getDb } from "@/db";
import { checkins, dailyLogs, users, workouts } from "@/db/schema";
import { Card, Stat } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { requireAdmin } from "@/lib/admin";
import { fmtDate, fmtNum } from "@/lib/format";
import { DeleteUser, EditUser, InviteCode, MoveClient, ResetPassword, Suspend } from "@/components/admin-ui";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) notFound();
  const [coach] = u.coachId ? await db.select().from(users).where(eq(users.id, u.coachId)) : [];
  const coaches = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "coach")).orderBy(asc(users.name));
  const clients = u.role === "coach" ? await db.select().from(users).where(eq(users.coachId, u.id)).orderBy(asc(users.name)) : [];
  const [[ci], [wo], [lastLog]] = await Promise.all([
    db.select({ n: count(), last: max(checkins.date) }).from(checkins).where(eq(checkins.clientId, u.id)),
    db.select({ n: count() }).from(workouts).where(eq(workouts.clientId, u.id)),
    db.select({ date: dailyLogs.date }).from(dailyLogs).where(eq(dailyLogs.clientId, u.id)).orderBy(desc(dailyLogs.date)).limit(1),
  ]);
  const isSelf = u.id === admin.id;
  const dateLong = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <Link href="/admin/users" className="text-sm text-muted hover:text-text">
        ← All users
      </Link>
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <Avatar name={u.name} avatarKey={u.avatarKey} size="lg" />
        <div className="min-w-0 space-y-0.5">
          <h2 className="truncate text-xl font-semibold">{u.name}</h2>
          <p className="truncate text-sm text-muted">{u.email}</p>
          <p className="text-sm text-muted">
            <span className="capitalize">{u.role}</span> · joined {dateLong(u.createdAt)}
          </p>
          {u.suspendedAt && <p className="text-sm font-medium text-danger">Suspended since {dateLong(u.suspendedAt)}</p>}
          {u.mustChangePassword && <p className="text-sm text-muted">Has a temporary password</p>}
        </div>
      </section>

      {u.role === "client" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Check-ins" value={fmtNum(ci?.n ?? 0)} sub={ci?.last ? `Last ${fmtDate(ci.last)}` : undefined} />
            <Stat label="Workouts" value={fmtNum(wo?.n ?? 0)} />
            <Stat label="Last logged" value={lastLog ? fmtDate(lastLog.date) : "Never"} />
          </div>
          <Card title="Coach">
            <p className="mb-3 text-sm">{coach ? <>Currently coached by <Link href={`/admin/users/${coach.id}`} className="font-medium text-accent">{coach.name}</Link></> : "No coach."}</p>
            <MoveClient userId={u.id} current={u.coachId} coaches={coaches} />
          </Card>
        </>
      ) : (
        <Card title={`Clients (${clients.length})`}>
          <InviteCode userId={u.id} code={u.inviteCode} />
          {clients.length > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/users/${c.id}`} className="flex items-center gap-3 py-2 hover:text-accent">
                    <Avatar name={c.name} avatarKey={c.avatarKey} />
                    <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                    {c.suspendedAt && <span className="text-xs text-danger">Suspended</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Details">
        <EditUser userId={u.id} name={u.name} email={u.email} />
      </Card>

      <Card title="Login help">
        <ResetPassword userId={u.id} name={u.name} />
      </Card>

      {!isSelf && (
        <Card title="Danger zone">
          <div className="space-y-4">
            <Suspend userId={u.id} name={u.name} suspended={!!u.suspendedAt} />
            <DeleteUser userId={u.id} name={u.name} email={u.email} hasClients={clients.length > 0} />
          </div>
        </Card>
      )}
    </>
  );
}
