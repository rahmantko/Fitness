import { fmtMacro as fmtG, type Macros } from "@/lib/macros";

const ROWS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: "kcal", label: "Calories", unit: " kcal" },
  { key: "protein", label: "Protein", unit: " g" },
  { key: "carbs", label: "Carbs", unit: " g" },
  { key: "fat", label: "Fat", unit: " g" },
];

/** Logged vs target for each macro as a progress bar with the number spelled out. */
export function MacroBars({ logged, target }: { logged: Macros; target: Macros | null }) {
  if (!target) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ROWS.map(({ key, label, unit }) => (
          <div key={key} className="rounded-xl bg-surface-2 p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {key === "kcal" ? Math.round(logged[key]).toLocaleString("en-GB") : fmtG(logged[key])}
              <span className="text-sm font-normal text-muted">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {ROWS.map(({ key, label, unit }) => {
        const v = logged[key];
        const t = target?.[key] ?? 0;
        const pct = t > 0 ? v / t : 0;
        const over = t > 0 && pct > 1.05;
        const left = t - v;
        const fmtMacro = (n: number) => (key === "kcal" ? Math.round(n).toLocaleString("en-GB") : fmtG(n));
        return (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{label}</span>
              <span className="tabular-nums">
                {fmtMacro(v)}
                {t > 0 && <span className="text-muted"> / {fmtMacro(t)}{unit}</span>}
                {t > 0 && (
                  <span className={`ml-2 text-xs ${over ? "text-warn" : "text-muted"}`}>
                    {left >= 0 ? `${fmtMacro(left)} left` : `${fmtMacro(-left)} over`}
                  </span>
                )}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label={label}
              aria-valuenow={Math.round(v)}
              aria-valuemax={Math.round(t) || undefined}
            >
              <div
                className={`h-full rounded-full ${over ? "bg-warn" : "bg-accent"}`}
                style={{ width: `${Math.min(100, Math.round(pct * 100))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
