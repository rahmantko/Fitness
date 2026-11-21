import { requireUser } from "@/lib/session";
import { getBloodTests } from "@/lib/queries";
import { fmtDate, fmtNum, today } from "@/lib/format";
import { Card, Empty } from "@/components/ui";
import { BloodTestForm } from "@/components/forms";
import { TrendLine } from "@/components/charts";

function flag(v: number, lo: number | null, hi: number | null) {
  if (lo != null && v < lo) return "Low";
  if (hi != null && v > hi) return "High";
  return null;
}

export default async function BloodworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  const tests = await getBloodTests(id); // newest first

  // Markers that appear in 2+ tests get a trend chart.
  const series = new Map<string, { date: string; value: number; unit: string | null; lo: number | null; hi: number | null }[]>();
  for (const t of [...tests].reverse()) {
    for (const m of t.markers) {
      const key = m.name.trim();
      series.set(key, [...(series.get(key) ?? []), { date: t.date, value: m.value, unit: m.unit, lo: m.refLow, hi: m.refHigh }]);
    }
  }
  const trends = [...series.entries()].filter(([, pts]) => pts.length >= 2);

  return (
    <>
      {viewer.role === "client" && (
        <Card title="Add blood test">
          <BloodTestForm date={today()} />
        </Card>
      )}

      {trends.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {trends.map(([name, pts]) => {
            const last = pts.at(-1)!;
            return (
              <Card key={name} title={name} action={<span className="text-xs text-muted">{last.unit}</span>}>
                <TrendLine
                  data={pts.map((p) => ({ date: p.date, value: p.value }))}
                  unit={last.unit ?? ""}
                  refLow={last.lo}
                  refHigh={last.hi}
                  height={180}
                />
                {last.lo != null && last.hi != null && (
                  <p className="mt-1 text-xs text-muted">Shaded band: reference range {fmtNum(last.lo)}–{fmtNum(last.hi)}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="pt-2 text-lg font-semibold">All results</h2>
      {tests.length === 0 && <Empty>No blood tests yet.</Empty>}
      {tests.map((t) => (
        <Card
          key={t.id}
          title={<>{fmtDate(t.date)}{t.lab && <span className="font-normal text-muted"> · {t.lab}</span>}</>}
          action={
            t.fileKey && (
              <a href={`/api/files/${t.fileKey}`} target="_blank" className="text-sm text-accent">
                View report{t.fileName ? ` (${t.fileName})` : ""}
              </a>
            )
          }
        >
          {t.markers.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="py-1.5 text-left font-medium">Marker</th>
                  <th className="py-1.5 text-right font-medium">Result</th>
                  <th className="hidden py-1.5 text-right font-medium sm:table-cell">Reference</th>
                  <th className="py-1.5 text-right font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {t.markers.map((m) => {
                  const f = flag(m.value, m.refLow, m.refHigh);
                  return (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="py-1.5">{m.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtNum(m.value, 2)} {m.unit}</td>
                      <td className="hidden py-1.5 text-right tabular-nums text-muted sm:table-cell">
                        {m.refLow != null || m.refHigh != null ? `${fmtNum(m.refLow, 2)}–${fmtNum(m.refHigh, 2)}` : "–"}
                      </td>
                      <td className={`py-1.5 text-right text-xs font-medium ${f ? "text-warn" : "text-muted"}`}>
                        {f ? `▲▼`[f === "High" ? 0 : 1] + " " + f : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">Report uploaded, no markers entered.</p>
          )}
          {t.notes && <p className="mt-2 text-sm text-muted">{t.notes}</p>}
        </Card>
      ))}
      <p className="text-xs text-muted">
        Blood results are stored privately and only visible to you and your coach. This app does not give medical advice.
      </p>
    </>
  );
}
