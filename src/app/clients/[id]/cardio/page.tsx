import Link from "next/link";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { cardioLogs, cardioPlan, dailyLogs } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getTargets } from "@/lib/queries";
import { fmtDate, fmtNum, today } from "@/lib/format";
import { Card, Empty } from "@/components/ui";
import { CardioForm, RemoveCardioButton } from "@/components/cardio-ui";
import { StepsForm, StepsImportForm } from "@/components/forms";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CardioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week } = await searchParams;
  const viewer = await requireUser();
  const isClient = viewer.role === "client";
  const offset = Math.max(-52, Math.min(0, Number.parseInt(week ?? "0", 10) || 0));

  const now = today();
  const dow = (new Date(now + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = Monday
  const monday = addDays(now, -dow + offset * 7);
  const sunday = addDays(monday, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const db = await getDb();
  const [plan, logs, steps, t, recent] = await Promise.all([
    db.select().from(cardioPlan).where(eq(cardioPlan.clientId, id)),
    db
      .select()
      .from(cardioLogs)
      .where(and(eq(cardioLogs.clientId, id), gte(cardioLogs.date, monday), lte(cardioLogs.date, sunday))),
    db
      .select({ date: dailyLogs.date, steps: dailyLogs.steps })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.clientId, id), gte(dailyLogs.date, monday), lte(dailyLogs.date, sunday))),
    getTargets(id),
    db.select().from(cardioLogs).where(eq(cardioLogs.clientId, id)).orderBy(desc(cardioLogs.date), desc(cardioLogs.createdAt)).limit(15),
  ]);
  const task = (i: number) => plan.find((p) => p.weekday === i)?.task ?? null;
  const totalMin = logs.reduce((a, l) => a + (l.durationMin ?? 0), 0);
  const stepDays = steps.filter((s) => s.steps != null);
  const avgSteps = stepDays.length ? Math.round(stepDays.reduce((a, s) => a + (s.steps ?? 0), 0) / stepDays.length) : null;
  const todaySteps = steps.find((s) => s.date === now)?.steps ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?week=${offset - 1}`} aria-label="Previous week" className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">‹</Link>
          <span className="min-w-[10rem] text-center font-semibold">
            {offset === 0 ? "This week" : `${fmtDate(monday)} – ${fmtDate(sunday)}`}
          </span>
          {offset < 0 && (
            <Link href={`?week=${offset + 1}`} aria-label="Next week" className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">›</Link>
          )}
        </div>
        <span className="text-sm text-muted tabular-nums">
          {totalMin} min cardio · {avgSteps != null ? `${fmtNum(avgSteps)} avg steps` : "no steps logged"}
          {t?.steps ? ` (target ${fmtNum(t.steps)})` : ""}
        </span>
      </div>

      <Card title="Plan vs done">
        {plan.length === 0 && <p className="mb-3 text-sm text-muted">{isClient ? "Your coach hasn't set a cardio plan yet." : "No cardio plan yet. Set one on the Plan tab."}</p>}
        <ul className="divide-y divide-border">
          {days.map((d, i) => {
            const done = logs.filter((l) => l.date === d);
            const st = steps.find((s) => s.date === d)?.steps ?? null;
            const planned = task(i);
            const stepsHit = t?.steps != null && st != null && st >= t.steps;
            const isToday = d === now;
            const future = d > now;
            const status = done.length > 0 || (planned && /steps/i.test(planned) && stepsHit) ? "done" : future || !planned ? "none" : "missed";
            return (
              <li key={d} className={`grid grid-cols-[3.5rem_1fr_auto] items-start gap-3 py-2.5 ${isToday ? "-mx-2 rounded-lg bg-accent-soft px-2" : ""}`}>
                <div>
                  <div className={`text-sm ${isToday ? "font-semibold" : ""}`}>{WEEKDAYS[i]}</div>
                  <div className="text-xs text-muted">{d.slice(8)}</div>
                </div>
                <div className="min-w-0 text-sm">
                  <div>{planned ?? <span className="text-muted">Rest</span>}</div>
                  {done.map((l) => (
                    <div key={l.id} className="text-xs text-muted">
                      ✓ {l.activity}
                      {l.durationMin != null && ` · ${l.durationMin} min`}
                      {l.distanceKm != null && ` · ${fmtNum(l.distanceKm)} km`}
                    </div>
                  ))}
                  <div className="text-xs text-muted tabular-nums">
                    {st != null ? `${fmtNum(st)} steps` : future ? "" : "No steps logged"}
                  </div>
                </div>
                <span
                  className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                    status === "done" ? "bg-accent text-accent-text" : status === "missed" ? "bg-surface-2 text-warn" : "text-muted"
                  }`}
                >
                  {status === "done" ? "Done" : status === "missed" ? "Not logged" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {isClient && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Log cardio">
            <CardioForm date={now} />
          </Card>
          <Card title="Log steps">
            <StepsForm date={now} steps={todaySteps} />
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted">Import steps from a CSV</summary>
              <div className="mt-3"><StepsImportForm /></div>
            </details>
          </Card>
        </div>
      )}

      <Card title="Recent cardio">
        {recent.length === 0 ? (
          <Empty>No cardio logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="font-medium">{l.activity}</div>
                  <div className="text-xs text-muted tabular-nums">
                    {fmtDate(l.date)}
                    {l.durationMin != null && ` · ${l.durationMin} min`}
                    {l.distanceKm != null && ` · ${fmtNum(l.distanceKm)} km`}
                    {l.avgHr != null && ` · ${l.avgHr} bpm`}
                    {l.kcal != null && ` · ${l.kcal} kcal`}
                    {l.notes && ` · ${l.notes}`}
                  </div>
                </div>
                {isClient && <RemoveCardioButton id={l.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
