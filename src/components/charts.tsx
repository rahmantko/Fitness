"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })}k` : String(n);

type Point = { date: string; value: number | null };

const axis = { fontSize: 11, fill: "var(--muted)" };

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length || payload[0].value == null) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-muted">{label ? shortDate(label) : ""}</div>
      <div className="font-semibold tabular-nums text-text">
        {payload[0].value.toLocaleString("en-GB")} {unit}
      </div>
    </div>
  );
}

/** Single-series trend line (weight, a blood marker…) with optional target or reference band. */
export function TrendLine({
  data,
  unit,
  target,
  refLow,
  refHigh,
  height = 220,
}: {
  data: Point[];
  unit: string;
  target?: number | null;
  refLow?: number | null;
  refHigh?: number | null;
  height?: number;
}) {
  const pts = data.filter((d) => d.value != null);
  if (pts.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  const values = pts.map((d) => d.value as number);
  if (target != null) values.push(target);
  if (refLow != null) values.push(refLow);
  if (refHigh != null) values.push(refHigh);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, Math.abs(max) * 0.01, 0.5);
  return (
    <div style={{ height }} role="img" aria-label={`Trend chart in ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
          {refLow != null && refHigh != null && (
            <ReferenceArea y1={refLow} y2={refHigh} fill="var(--accent)" fillOpacity={0.08} stroke="none" />
          )}
          <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            domain={[Math.max(min >= 0 ? 0 : -Infinity, Math.floor((min - pad) * 10) / 10), Math.ceil((max + pad) * 10) / 10]}
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{ value: "Goal", position: "insideTopRight", fontSize: 11, fill: "var(--muted)" }}
            />
          )}
          <Tooltip
            content={<TooltipBox unit={unit} />}
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={pts.length <= 20 ? { r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 } : false}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily bars (steps, calories) with an optional dashed target line (named in the card title). */
export function DailyBars({
  data,
  unit,
  target,
  height = 200,
}: {
  data: Point[];
  unit: string;
  target?: number | null;
  height?: number;
}) {
  if (!data.some((d) => d.value != null)) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <div style={{ height }} role="img" aria-label={`Daily ${unit} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
          <Tooltip content={<TooltipBox unit={unit} />} cursor={{ fill: "var(--surface-2)" }} />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--muted)"
              strokeDasharray="4 4"
            />
          )}
          <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
