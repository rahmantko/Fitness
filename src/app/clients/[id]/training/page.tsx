import { requireUser } from "@/lib/session";
import { getWorkouts } from "@/lib/queries";
import { fmtDate, fmtNum, today } from "@/lib/format";
import { Card, Empty } from "@/components/ui";
import { WorkoutForm } from "@/components/forms";

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  const list = await getWorkouts(id, 50);

  // Best set (heaviest weight, then most reps) per exercise across recent sessions.
  const best = new Map<string, { weightKg: number; reps: number | null; date: string }>();
  for (const w of list) {
    for (const s of w.sets) {
      if (s.weightKg == null) continue;
      const b = best.get(s.exercise);
      if (!b || s.weightKg > b.weightKg || (s.weightKg === b.weightKg && (s.reps ?? 0) > (b.reps ?? 0))) {
        best.set(s.exercise, { weightKg: s.weightKg, reps: s.reps, date: w.date });
      }
    }
  }
  const exercises = [...new Set(list.flatMap((w) => w.sets.map((s) => s.exercise)))].sort();

  return (
    <>
      {viewer.role === "client" && (
        <Card title="Log a workout">
          <WorkoutForm date={today()} exercises={exercises} />
        </Card>
      )}

      {best.size > 0 && (
        <Card title="Best sets">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[...best.entries()].map(([ex, b]) => (
              <div key={ex} className="rounded-xl bg-surface-2 p-3">
                <div className="truncate text-xs text-muted" title={ex}>{ex}</div>
                <div className="mt-1 font-semibold tabular-nums">
                  {fmtNum(b.weightKg)} kg{b.reps != null && ` × ${b.reps}`}
                </div>
                <div className="text-xs text-muted">{fmtDate(b.date)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <h2 className="pt-2 text-lg font-semibold">History</h2>
      {list.length === 0 && <Empty>No workouts logged yet.</Empty>}
      {list.map((w) => {
        const groups = new Map<string, typeof w.sets>();
        for (const s of w.sets) groups.set(s.exercise, [...(groups.get(s.exercise) ?? []), s]);
        const volume = w.sets.reduce((a, s) => a + (s.reps ?? 0) * (s.weightKg ?? 0), 0);
        return (
          <Card
            key={w.id}
            title={<>{w.name} <span className="font-normal text-muted">· {fmtDate(w.date)}</span></>}
            action={<span className="text-xs text-muted tabular-nums">{w.sets.length} sets · {fmtNum(Math.round(volume))} kg volume</span>}
          >
            <ul className="space-y-1.5 text-sm">
              {[...groups.entries()].map(([ex, sets]) => (
                <li key={ex} className="flex flex-wrap gap-x-3">
                  <span className="min-w-[10rem] font-medium">{ex}</span>
                  <span className="tabular-nums text-muted">
                    {sets
                      .map((s) => `${s.weightKg != null ? fmtNum(s.weightKg) + " kg" : "BW"} × ${s.reps ?? "?"}${s.rpe != null ? ` @${s.rpe}` : ""}`)
                      .join(", ")}
                  </span>
                </li>
              ))}
            </ul>
            {w.notes && <p className="mt-2 text-sm text-muted">{w.notes}</p>}
          </Card>
        );
      })}
    </>
  );
}
