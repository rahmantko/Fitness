import { requireUser } from "@/lib/session";
import { fillDays, getDailyLogs, getTargets } from "@/lib/queries";
import { fmtDate, fmtNum, isIsoDate, today } from "@/lib/format";
import { Card } from "@/components/ui";
import { DailyLogForm } from "@/components/forms";
import { DailyBars } from "@/components/charts";

function pct(v: number | null | undefined, target: number | null | undefined) {
  if (v == null || !target) return null;
  return v / target;
}

function Cell({ v, target, unit = "" }: { v: number | null | undefined; target?: number | null; unit?: string }) {
  const p = pct(v, target);
  const off = p != null && Math.abs(p - 1) > 0.1;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${off ? "text-warn" : ""}`} title={p != null ? `${Math.round(p * 100)}% of target` : undefined}>
      {v == null ? <span className="text-muted">–</span> : `${fmtNum(v)}${unit}`}
    </td>
  );
}

export default async function DailyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: qDate } = await searchParams;
  const viewer = await requireUser();
  const [logs, t] = await Promise.all([getDailyLogs(id, 60), getTargets(id)]);
  const date = isIsoDate(qDate) ? qDate : today();
  const days = fillDays(logs, 30);

  return (
    <>
      {viewer.role === "client" && (
        <Card title={`Weight & steps for ${date === today() ? "today" : fmtDate(date)}`}>
          <DailyLogForm date={date} existing={logs.find((l) => l.date === date)} />
          <p className="mt-3 text-xs text-muted">Pick a date to edit an earlier day. Calories and macros come from the Nutrition tab.</p>
        </Card>
      )}

      <Card title={t?.calories ? "Calories (30 days, dashed line = target)" : "Calories (30 days)"}>
        <DailyBars data={days.map((d) => ({ date: d.date, value: d.row?.calories ?? null }))} unit="kcal" target={t?.calories} />
      </Card>

      <Card title="Last 30 days">
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Weight</th>
                <th className="px-3 py-2 text-right font-medium">Steps</th>
                <th className="px-3 py-2 text-right font-medium">Calories</th>
                <th className="px-3 py-2 text-right font-medium">Protein</th>
                <th className="px-3 py-2 text-right font-medium">Carbs</th>
                <th className="px-3 py-2 text-right font-medium">Fat</th>
              </tr>
              {t && (
                <tr className="border-b border-border">
                  <th className="px-3 py-1 text-left font-normal">Target</th>
                  <th className="px-3 py-1 text-right font-normal">{t.goalWeightKg != null ? `${fmtNum(t.goalWeightKg)} kg` : "–"}</th>
                  <th className="px-3 py-1 text-right font-normal">{fmtNum(t.steps)}</th>
                  <th className="px-3 py-1 text-right font-normal">{fmtNum(t.calories)}</th>
                  <th className="px-3 py-1 text-right font-normal">{t.protein != null ? `${t.protein} g` : "–"}</th>
                  <th className="px-3 py-1 text-right font-normal">{t.carbs != null ? `${t.carbs} g` : "–"}</th>
                  <th className="px-3 py-1 text-right font-normal">{t.fat != null ? `${t.fat} g` : "–"}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {[...days].reverse().map(({ date: d, row }) => (
                <tr key={d} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {viewer.role === "client" ? (
                      <a href={`?date=${d}`} className="hover:text-accent">{fmtDate(d)}</a>
                    ) : (
                      fmtDate(d)
                    )}
                    {row?.notes && <div className="max-w-[16rem] truncate text-xs text-muted">{row.notes}</div>}
                  </td>
                  <Cell v={row?.weightKg} unit=" kg" />
                  <Cell v={row?.steps} target={t?.steps} />
                  <Cell v={row?.calories} target={t?.calories} />
                  <Cell v={row?.protein} target={t?.protein} unit=" g" />
                  <Cell v={row?.carbs} target={t?.carbs} unit=" g" />
                  <Cell v={row?.fat} target={t?.fat} unit=" g" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t && <p className="mt-3 text-xs text-muted">Amber values are more than 10% off target.</p>}
      </Card>
    </>
  );
}
