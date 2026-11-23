import Link from "next/link";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { and, count, countDistinct, desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { cardioLogs, checkinComments, checkins, dailyLogs, foods, users, workouts } from "@/db/schema";
import { Card, Stat } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { daysAgo, fmtNum } from "@/lib/format";

async function folderSize(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  try {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const s = await folderSize(p);
        bytes += s.bytes;
        files += s.files;
      } else {
        bytes += (await stat(p)).size;
        files++;
      }
    }
  } catch {}
  return { bytes, files };
}

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export default async function AdminHome() {
  const db = await getDb();
  const week = daysAgo(7);
  const weekTs = new Date(week + "T00:00:00Z");
  const monthTs = new Date(daysAgo(30) + "T00:00:00Z");
  const one = async <T,>(q: Promise<T[]>) => (await q)[0];

  const [roles, signups7, signups30, suspended, active7, checkins7, workouts7, cardio7, waiting, comments7, foodCount, recent, coaches, storage] =
    await Promise.all([
      db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
      one(db.select({ n: count() }).from(users).where(gte(users.createdAt, weekTs))),
      one(db.select({ n: count() }).from(users).where(gte(users.createdAt, monthTs))),
      one(db.select({ n: count() }).from(users).where(isNotNull(users.suspendedAt))),
      one(db.select({ n: countDistinct(dailyLogs.clientId) }).from(dailyLogs).where(gte(dailyLogs.date, week))),
      one(db.select({ n: count() }).from(checkins).where(gte(checkins.date, week))),
      one(db.select({ n: count() }).from(workouts).where(gte(workouts.date, week))),
      one(db.select({ n: count() }).from(cardioLogs).where(gte(cardioLogs.date, week))),
      one(
        db
          .select({ n: count() })
          .from(checkins)
          .where(and(isNull(checkins.coachFeedback), isNull(checkins.feedbackAudioKey), isNull(checkins.feedbackVideoUrl))),
      ),
      one(db.select({ n: count() }).from(checkinComments).where(gte(checkinComments.createdAt, weekTs))),
      one(db.select({ n: count() }).from(foods).where(or(isNull(foods.createdBy), eq(foods.source, "openfoodfacts")))),
      db.select().from(users).orderBy(desc(users.createdAt)).limit(8),
      db.select().from(users).where(eq(users.role, "coach")).orderBy(users.name),
      folderSize(path.join(process.cwd(), "data", "uploads")),
    ]);
  const clientsPerCoach = await db
    .select({ coachId: users.coachId, n: count() })
    .from(users)
    .where(eq(users.role, "client"))
    .groupBy(users.coachId);
  const nCoaches = roles.find((r) => r.role === "coach")?.n ?? 0;
  const nClients = roles.find((r) => r.role === "client")?.n ?? 0;
  const onRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
  const volume = !!process.env.RAILWAY_VOLUME_MOUNT_PATH;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Coaches" value={fmtNum(nCoaches)} />
        <Stat label="Clients" value={fmtNum(nClients)} sub={suspended?.n ? `${suspended.n} suspended` : undefined} />
        <Stat label="New sign-ups (7 days)" value={fmtNum(signups7?.n ?? 0)} sub={`${signups30?.n ?? 0} in 30 days`} />
        <Stat
          label="Active clients (7 days)"
          value={fmtNum(active7?.n ?? 0)}
          sub={nClients ? `${Math.round(((active7?.n ?? 0) / nClients) * 100)}% of clients` : undefined}
          tone={nClients && (active7?.n ?? 0) / nClients >= 0.5 ? "good" : undefined}
        />
      </div>

      <Card title="Last 7 days">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Check-ins" value={fmtNum(checkins7?.n ?? 0)} />
          <Stat label="Workouts logged" value={fmtNum(workouts7?.n ?? 0)} />
          <Stat label="Cardio sessions" value={fmtNum(cardio7?.n ?? 0)} />
          <Stat label="Feedback replies" value={fmtNum(comments7?.n ?? 0)} />
        </div>
        {(waiting?.n ?? 0) > 0 && (
          <p className="mt-3 text-sm text-warn">{waiting!.n} check-in{waiting!.n === 1 ? " is" : "s are"} still waiting for coach feedback.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Newest accounts" action={<Link href="/admin/users" className="text-sm text-accent">All users →</Link>}>
          <ul className="divide-y divide-border">
            {recent.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 py-2 hover:text-accent">
                  <Avatar name={u.name} avatarKey={u.avatarKey} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className="capitalize">{u.role}</span> · joined {u.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  {u.suspendedAt && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-danger">Suspended</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Coaches">
          {coaches.length === 0 ? (
            <p className="text-sm text-muted">No coaches yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {coaches.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/users/${c.id}`} className="flex items-center gap-3 py-2 hover:text-accent">
                    <Avatar name={c.name} avatarKey={c.avatarKey} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="text-sm tabular-nums text-muted">
                      {clientsPerCoach.find((x) => x.coachId === c.id)?.n ?? 0} clients
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="System">
        <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Photo & file storage</dt>
          <dd>
            {fmtBytes(storage.bytes)} in {fmtNum(storage.files)} files
            {onRailway && !volume && <span className="block text-danger">No Railway volume attached: uploads are lost on every redeploy.</span>}
            {onRailway && volume && <span className="block text-muted">Saved on your Railway volume.</span>}
          </dd>
          <dt className="text-muted">Food database</dt>
          <dd>{fmtNum(foodCount?.n ?? 0)} shared foods (starter list and saved barcode / online foods)</dd>
          <dt className="text-muted">Password emails</dt>
          <dd>{process.env.BREVO_API_KEY ? "Brevo connected" : process.env.RESEND_API_KEY ? "Resend connected" : <span className="text-warn">Not set up, so reset emails aren&apos;t sent</span>}</dd>
        </dl>
      </Card>
    </>
  );
}
