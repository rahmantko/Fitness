"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  createFood,
  importOnlineFood,
  lookupBarcode,
  searchFoods,
  searchOnline,
  type BarcodeResult,
  type CreateFoodState,
} from "@/app/nutrition-actions";
import type { OffFood } from "@/lib/openfoodfacts";
import { BarcodeScanner } from "./barcode-scanner";
import type { Food } from "@/db/schema";
import { fmtMacro, scaleFood } from "@/lib/macros";
import { inputBase, inputCls } from "./ui";

/**
 * Search the food library, pick a food, set the amount and add it.
 * Used by clients (logging) and coaches (building meal plans).
 */
export function FoodPicker({
  onAdd,
  onClose,
  clientId,
}: {
  onAdd: (foodId: string, qty: number) => Promise<void>;
  onClose: () => void;
  clientId?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [qty, setQty] = useState("");
  const [creating, setCreating] = useState<Prefill | null>(null);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState<{ query: string; results: OffFood[]; error?: string } | null>(null);
  const [onlineTry, setOnlineTry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchFoods(query, clientId);
      if (!cancelled) setResults(r);
    }, query ? 200 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, clientId]);

  // Branded and packaged foods come from Open Food Facts, searched automatically as you type.
  const q = query.trim();
  useEffect(() => {
    if (q.length < 3) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await searchOnline(q);
      if (cancelled) return;
      setOnline("error" in r ? { query: q, results: [], error: r.error } : { query: q, results: r.results });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, onlineTry]);
  const onlineHere = online?.query === q ? online : null;
  const onlineLoading = q.length >= 3 && !onlineHere;
  // Hide online products that are already in the library (e.g. scanned before).
  const known = new Set(results.map((f) => f.barcode).filter(Boolean));
  const onlineResults = (onlineHere?.results ?? []).filter((p) => !known.has(p.barcode));

  useEffect(() => searchRef.current?.focus(), []);

  function pick(f: Food) {
    setPicked(f);
    setNotice(null);
    setQty(String(f.servingQty ?? f.baseQty));
    setTimeout(() => qtyRef.current?.select(), 0);
  }

  function handleResult(r: BarcodeResult) {
    if ("food" in r) return pick(r.food);
    if ("error" in r) return setNotice(r.error);
    if ("notFound" in r) {
      setNotice(`Barcode ${r.barcode} isn't in the food database yet. Add it below and it'll be saved for next time.`);
      return setCreating({ barcode: r.barcode });
    }
    const p = r.noNutrition;
    setNotice(`Found “${p.name}”, but it has no nutrition info. Copy the numbers from the label.`);
    setCreating({ name: p.name, brand: p.brand ?? "", unit: p.unit });
  }

  const onCode = useCallback((code: string) => {
    setScanning(false);
    setNotice("Looking up barcode…");
    start(async () => handleResult(await lookupBarcode(code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amount = Number(qty);
  const preview = picked && amount > 0 ? scaleFood(picked, amount) : null;

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      {picked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!(amount > 0)) return setError("Enter an amount.");
            setError(null);
            start(async () => {
              try {
                await onAdd(picked.id, amount);
                setPicked(null);
                setQuery("");
                searchRef.current?.focus();
              } catch (err) {
                setError((err as Error).message);
              }
            });
          }}
          className="space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{picked.name}</div>
              <div className="text-xs text-muted">
                {picked.brand && `${picked.brand} · `}per {fmtMacro(picked.baseQty)} {picked.unit}: {fmtMacro(picked.kcal)} kcal
                {picked.servingQty != null && ` · 1 serving = ${fmtMacro(picked.servingQty)} ${picked.unit}`}
              </div>
              {picked.source === "openfoodfacts" && <div className="text-xs text-muted">From Open Food Facts</div>}
            </div>
            <button type="button" onClick={() => setPicked(null)} className="text-sm text-muted hover:text-text">
              Back
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={qtyRef}
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-label="Amount"
              className={`${inputBase} w-28`}
            />
            <span className="text-sm text-muted">{picked.unit}</span>
          </div>
          {preview && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {(
                [
                  ["kcal", preview.kcal, ""],
                  ["Protein", preview.protein, "g"],
                  ["Carbs", preview.carbs, "g"],
                  ["Fat", preview.fat, "g"],
                ] as const
              ).map(([l, v, u]) => (
                <div key={l} className="rounded-lg bg-surface p-2">
                  <div className="font-semibold tabular-nums">
                    {fmtMacro(v)}
                    {u}
                  </div>
                  <div className="text-muted">{l}</div>
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </form>
      ) : scanning ? (
        <BarcodeScanner onCode={onCode} onClose={() => setScanning(false)} />
      ) : creating ? (
        <div className="space-y-3">
          {notice && <p className="text-sm text-muted" role="status">{notice}</p>}
          <CreateFoodForm
            initial={{ name: query, ...creating }}
            onCreated={(f) => {
              setCreating(null);
              pick(f);
            }}
            onCancel={() => {
              setCreating(null);
              setNotice(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods…"
              aria-label="Search foods"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setScanning(true);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-accent-soft"
              aria-label="Scan barcode"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M10 8v8M13 8v8M17 8v8" />
              </svg>
              Scan
            </button>
            <button type="button" onClick={onClose} className="px-1 text-sm text-muted hover:text-text">
              Close
            </button>
          </div>
          {notice && <p className="text-sm text-muted" role="status">{pending ? "Working…" : notice}</p>}
          {!query && results.length > 0 && <div className="text-xs text-muted">Recent and suggested</div>}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg bg-surface">
            {results.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent-soft"
                >
                  <span>
                    <span className="block text-sm">{f.name}</span>
                    <span className="block text-xs text-muted">
                      {f.brand && `${f.brand} · `}
                      {fmtMacro(f.baseQty)} {f.unit}
                      {f.source === "openfoodfacts" && " · scanned"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                    {fmtMacro(f.kcal)} kcal
                    <br />
                    P{fmtMacro(f.protein)} C{fmtMacro(f.carbs)} F{fmtMacro(f.fat)}
                  </span>
                </button>
              </li>
            ))}
            {query && results.length === 0 && onlineResults.length === 0 && <li className="px-3 py-3 text-sm text-muted">No saved foods match “{query}”.</li>}
          </ul>
          {q.length >= 3 && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>More foods and brands (per 100 g/ml)</span>
                {onlineLoading && <span role="status">Searching…</span>}
              </div>
              {onlineHere?.error ? (
                <p className="text-sm text-muted">
                  {onlineHere.error}{" "}
                  <button type="button" onClick={() => { setOnline(null); setOnlineTry((n) => n + 1); }} className="font-medium text-accent">
                    Try again
                  </button>
                </p>
              ) : onlineResults.length > 0 ? (
                <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg bg-surface">
                  {onlineResults.map((p) => (
                    <li key={p.barcode}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => start(async () => handleResult(await importOnlineFood(p.barcode)))}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent-soft disabled:opacity-60"
                      >
                        <span>
                          <span className="block text-sm">{p.name}</span>
                          <span className="block text-xs text-muted">{p.brand ?? "Unbranded"}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                          {fmtMacro(p.kcal ?? 0)} kcal
                          <br />
                          P{fmtMacro(p.protein ?? 0)} C{fmtMacro(p.carbs ?? 0)} F{fmtMacro(p.fat ?? 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                onlineHere && <p className="text-sm text-muted">No branded products found. Try fewer words, scan the barcode, or create the food.</p>
              )}
            </div>
          )}
          <button type="button" onClick={() => setCreating({})} className="block text-sm font-medium text-accent">
            + Create a food
          </button>
        </div>
      )}
    </div>
  );
}

type Prefill = { name?: string; brand?: string; unit?: string; barcode?: string };

function CreateFoodForm({
  initial,
  onCreated,
  onCancel,
}: {
  initial: Prefill;
  onCreated: (f: Food) => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(async (prev: CreateFoodState, fd: FormData) => {
    const r = await createFood(prev, fd);
    if (r?.food) onCreated(r.food);
    return r;
  }, undefined);
  const small = `${inputCls} tabular-nums`;
  return (
    <form action={action} className="space-y-3">
      <div className="text-sm font-medium">New food</div>
      {initial.barcode && <input type="hidden" name="barcode" value={initial.barcode} />}
      <div className="grid grid-cols-2 gap-2">
        <input name="name" defaultValue={initial.name} placeholder="Name" aria-label="Name" required className={`${inputCls} col-span-2`} />
        <input name="brand" defaultValue={initial.brand} placeholder="Brand (optional)" aria-label="Brand" className={`${inputCls} col-span-2`} />
        <label className="text-xs text-muted">
          Nutrition per
          <input name="baseQty" type="number" step="any" min="0" defaultValue="100" required className={small} />
        </label>
        <label className="text-xs text-muted">
          Unit
          <input name="unit" defaultValue={initial.unit ?? "g"} required placeholder="g, ml, slice…" className={inputCls} />
        </label>
        <label className="text-xs text-muted">
          Calories
          <input name="kcal" type="number" step="any" min="0" required className={small} />
        </label>
        <label className="text-xs text-muted">
          Protein (g)
          <input name="protein" type="number" step="any" min="0" className={small} />
        </label>
        <label className="text-xs text-muted">
          Carbs (g)
          <input name="carbs" type="number" step="any" min="0" className={small} />
        </label>
        <label className="text-xs text-muted">
          Fat (g)
          <input name="fat" type="number" step="any" min="0" className={small} />
        </label>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text disabled:opacity-60">
          {pending ? "Saving…" : "Save food"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 text-sm text-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
