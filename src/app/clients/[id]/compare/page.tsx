import { getCheckins } from "@/lib/queries";
import { fmtDate, fmtDelta, fmtNum } from "@/lib/format";
import { Card, Empty, inputCls } from "@/components/ui";
import type { Checkin } from "@/db/schema";

const METRICS: { key: keyof Checkin; label: string; unit: string }[] = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "hipsCm", label: "Hips", unit: "cm" },
  { key: "armCm", label: "Arm", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
  { key: "energy", label: "Energy", unit: "/10" },
  { key: "sleep", label: "Sleep", unit: "/10" },
  { key: "adherence", label: "Adherence", unit: "/10" },
];

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const list = await getCheckins(id); // newest first
  if (list.length < 2) {
    return <Empty>You need at least two check-ins to compare.</Empty>;
  }
  const a = list.find((c) => c.id === q.a) ?? list.at(-1)!;
  const b = list.find((c) => c.id === q.b) ?? list[0];
  const days = Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86_400_000);

  const options = list.map((c) => (
    <option key={c.id} value={c.id}>
      {fmtDate(c.date)}
      {c.weightKg != null ? ` · ${fmtNum(c.weightKg)} kg` : ""}
    </option>
  ));

  return (
    <>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Before</span>
          <select name="a" defaultValue={a.id} className={inputCls}>{options}</select>
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">After</span>
          <select name="b" defaultValue={b.id} className={inputCls}>{options}</select>
        </label>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text">Compare</button>
      </form>

      <Card title={`${fmtDate(a.date)} → ${fmtDate(b.date)}`} action={<span className="text-sm text-muted">{Math.abs(days)} days</span>}>
        <div className="space-y-4">
          {(["front", "side", "back"] as const).map((pose) => {
            const pa = a.photos.find((p) => p.pose === pose);
            const pb = b.photos.find((p) => p.pose === pose);
            if (!pa && !pb) return null;
            return (
              <div key={pose}>
                <h3 className="mb-2 text-sm font-medium capitalize">{pose}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[pa, pb].map((p, i) =>
                    p ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={`/api/files/${p.fileKey}`} alt={`${pose} ${i ? "after" : "before"}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                    ) : (
                      <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-xl bg-surface-2 text-xs text-muted">
                        No photo
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
          {a.photos.length + b.photos.length === 0 && <Empty>Neither check-in has photos.</Empty>}
        </div>
      </Card>

      <Card title="Measurements">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">Metric</th>
              <th className="py-2 text-right font-medium">Before</th>
              <th className="py-2 text-right font-medium">After</th>
              <th className="py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, unit }) => {
              const va = a[key] as number | null;
              const vb = b[key] as number | null;
              if (va == null && vb == null) return null;
              const sep = unit.startsWith("/") ? "" : " ";
              const digits = Number.isInteger(va ?? 0) && Number.isInteger(vb ?? 0) ? 0 : 1;
              return (
                <tr key={key} className="border-b border-border last:border-0">
                  <td className="py-2">{label}</td>
                  <td className="py-2 text-right tabular-nums">{va != null ? `${fmtNum(va)}${sep}${unit}` : "–"}</td>
                  <td className="py-2 text-right tabular-nums">{vb != null ? `${fmtNum(vb)}${sep}${unit}` : "–"}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {va != null && vb != null ? `${fmtDelta(vb - va, digits)}${sep}${unit}` : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
