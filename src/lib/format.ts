export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function fmtNum(n: number | null | undefined, digits = 1) {
  if (n == null) return "–";
  return Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toFixed(digits);
}

/** Signed difference, e.g. "+1.2" or "−0.4". */
export function fmtDelta(n: number | null | undefined, digits = 1) {
  if (n == null) return "–";
  if (Math.abs(n) < 10 ** -digits / 2) return "0";
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : `−${s}`;
}

export function num(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function int(v: FormDataEntryValue | null): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

export function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
