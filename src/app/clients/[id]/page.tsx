import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fillDays, getCheckins, getDailyLogs, getTargets } from "@/lib/queries";
import { fmtDate, fmtDelta, fmtNum, today } from "@/lib/format";
import { ButtonLink, Card, Empty, Stat } from "@/components/ui";
import { DailyLogForm, TargetsForm } from "@/components/forms";
import { ResetClientPassword } from "@/components/password-forms";
import { getViewableClient } from "@/lib/session";
import { DailyBars, TrendLine } from "@/components/charts";

function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  const isClient = viewer.role === "client";
  const [logs, checkins, t] = await Promise.all([getDailyLogs(id, 90), getCheckins(id), getTargets(id)]);

  // Weight series: daily logs plus check-in weights on days without a log.
  const byDate = new Map<string, number>();
  for (const c of checkins) if (c.weightKg != null) byDate.set(c.date, c.weightKg);
  for (const l of logs) if (l.weightKg != null) byDate.set(l.date, l.weightKg);
  const weight = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  const current = weight.at(-1)?.value ?? null;
  const first30 = weight[0]?.value ?? null;
  const last7 = fillDays(logs, 7).map((d) => d.row);
  const avgSteps = avg(last7.map((r) => r?.steps ?? null));
  const avgCals = avg(last7.map((r) => r?.calories ?? null));
  const avgProtein = avg(last7.map((r) => r?.protein ?? null));
  const todayLog = logs.find((l) => l.date === today());
  const lastCheckin = checkins[0];
  const steps30 = fillDays(logs, 30).map((d) => ({ date: d.date, value: d.row?.steps ?? null }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Current weight"
          value={current != null ? `${fmtNum(current)} kg` : "–"}
          sub={t?.goalWeightKg != null ? `Goal ${fmtNum(t.goalWeightKg)} kg` : undefined}
        />
        <Stat
          label="Change (90 days)"
          value={current != null && first30 != null ? `${fmtDelta(current - first30)} kg` : "–"}
          sub={weight.length ? `since ${fmtDate(weight[0].date)}` : undefined}
        />
        <Stat
          label="Avg steps (7d)"
          value={fmtNum(avgSteps != null ? Math.round(avgSteps) : null)}
          sub={t?.steps ? `Target ${fmtNum(t.steps)}` : undefined}
          tone={t?.steps && avgSteps != null ? (avgSteps >= t.steps ? "good" : "warn") : undefined}
        />
        <Stat
          label="Avg calories (7d)"
          value={fmtNum(avgCals != null ? Math.round(avgCals) : null)}
          sub={
            t?.calories
              ? `Target ${fmtNum(t.calories)}${avgProtein != null ? ` · ${Math.round(avgProtein)} g protein` : ""}`
              : undefined
          }
        />
      </div>

      {isClient && (
        <Card title="Today’s weight & steps" action={<Link href={`/clients/${id}/nutrition`} className="text-sm text-accent">Log food →</Link>}>
          <DailyLogForm date={today()} existing={todayLog} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Bodyweight">
          <TrendLine data={weight} unit="kg" target={t?.goalWeightKg} />
        </Card>
        <Card title={t?.steps ? "Steps (30 days, dashed line = target)" : "Steps (30 days)"}>
          <DailyBars data={steps30} unit="steps" target={t?.steps} />
        </Card>
      </div>

      <Card
        title="Latest check-in"
        action={isClient ? <ButtonLink href={`/clients/${id}/checkins/new`}>New check-in</ButtonLink> : undefined}
      >
        {lastCheckin ? (
          <div className="space-y-2 text-sm">
            <p>
              <Link href={`/clients/${id}/checkins`} className="font-medium hover:text-accent">
                {fmtDate(lastCheckin.date)}
              </Link>
              {lastCheckin.weightKg != null && <span className="text-muted"> · {fmtNum(lastCheckin.weightKg)} kg</span>}
              <span className="text-muted"> · {lastCheckin.photos.length} photos</span>
            </p>
            {lastCheckin.coachFeedback ? (
              <blockquote className="rounded-xl bg-accent-soft p-3">
                <div className="mb-1 text-xs font-medium text-accent">Coach feedback</div>
                {lastCheckin.coachFeedback}
              </blockquote>
            ) : (
              <p className="text-muted">Waiting for coach feedback.</p>
            )}
          </div>
        ) : (
          <Empty>No check-ins yet.</Empty>
        )}
      </Card>

      {viewer.role === "coach" ? (
        <>
          <Card title="Targets">
            <TargetsForm clientId={id} t={t ?? undefined} />
          </Card>
          <Card title="Login help">
            <ResetClientPassword clientId={id} clientName={(await getViewableClient(viewer, id))?.name ?? "This client"} />
          </Card>
        </>
      ) : (
        t && (
          <Card title="Your targets">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Calories" value={fmtNum(t.calories)} />
              <Stat label="Protein" value={t.protein != null ? `${t.protein} g` : "–"} />
              <Stat label="Carbs" value={t.carbs != null ? `${t.carbs} g` : "–"} />
              <Stat label="Fat" value={t.fat != null ? `${t.fat} g` : "–"} />
              <Stat label="Steps" value={fmtNum(t.steps)} />
            </div>
          </Card>
        )
      )}
    </>
  );
}
