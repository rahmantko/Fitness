"use client";

import { useState, useTransition } from "react";
import {
  addMeal,
  addMealItem,
  copyPreviousDay,
  eatMealAsPlanned,
  fillMealFromPlan,
  quickAddItem,
  removeMeal,
  removeMealItem,
  setDayType,
  toggleDayComplete,
  toggleMealComplete,
  updateMealItemQty,
} from "@/app/nutrition-actions";
import type { DayType } from "@/db/schema";
import { fmtMacro, type Macros } from "@/lib/macros";
import { FoodPicker } from "./food-picker";
import { inputBase, inputCls } from "./ui";

type Item = { id: string; name: string; qty: number; unit: string } & Macros;
export type MealView = {
  id: string;
  name: string;
  completed: boolean;
  fromPlan: boolean;
  planHasFoods: boolean;
  planNotes: string | null;
  planned: { name: string; qty: number; unit: string; kcal: number }[];
  items: Item[];
  logged: Macros;
  target: Macros | null;
};

const COLS = "grid grid-cols-[1fr_2.6rem_2.4rem_2.4rem_2.2rem] sm:grid-cols-[1fr_4.5rem_4rem_4rem_4rem] gap-x-1.5 sm:gap-x-2 items-center";

/** "logged / target" with the target dimmed; amber if more than 10% off once the meal is done. */
function Ratio({ v, t, unit = "", strict, round }: { v: number; t?: number; unit?: string; strict?: boolean; round?: boolean }) {
  const f = (n: number) => (round ? Math.round(n).toLocaleString("en-GB") : fmtMacro(n));
  const off = strict && t != null && t > 0 && Math.abs(v / t - 1) > 0.1;
  return (
    <span className={`tabular-nums ${off ? "text-warn" : ""}`}>
      {f(v)}
      {t != null && <span className="text-muted">/{f(t)}</span>}
      {unit}
    </span>
  );
}

export function DayTypeToggle({ date, dayType, editable }: { date: string; dayType: DayType; editable: boolean }) {
  const [pending, start] = useTransition();
  if (!editable) {
    return (
      <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
        {dayType === "training" ? "Training day" : "Rest day"}
      </span>
    );
  }
  return (
    <div className={`inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm ${pending ? "opacity-60" : ""}`} role="group" aria-label="Day type">
      {(["training", "rest"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={dayType === t}
          onClick={() => dayType !== t && start(() => setDayType(date, t))}
          className={`rounded-md px-3 py-1 ${dayType === t ? "bg-accent font-medium text-accent-text" : "text-muted hover:text-text"}`}
        >
          {t === "training" ? "Training day" : "Rest day"}
        </button>
      ))}
    </div>
  );
}

/** How far the logged meal is from the coach's plan, in calories. */
function Variance({ logged, target }: { logged: Macros; target: Macros }) {
  const diff = Math.round(logged.kcal - target.kcal);
  const close = Math.abs(diff) <= Math.max(25, target.kcal * 0.05);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
        close ? "bg-accent-soft text-accent" : diff > 0 ? "bg-surface-2 text-warn" : "bg-surface-2 text-muted"
      }`}
    >
      {close ? "On plan" : diff > 0 ? `${diff} kcal over plan` : `${-diff} kcal under plan`}
    </span>
  );
}

function QuickAdd({ mealId, onDone }: { mealId: string; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = (v: FormDataEntryValue | null) => (v == null || String(v).trim() === "" ? null : Number(v));
  return (
    <form
      className="space-y-2 rounded-xl border border-border bg-surface-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const kcal = n(fd.get("kcal"));
        if (kcal == null || !(kcal >= 0)) return setError("Enter the calories.");
        start(async () => {
          const r = await quickAddItem(mealId, {
            name: String(fd.get("name") ?? ""),
            kcal,
            protein: n(fd.get("protein")),
            carbs: n(fd.get("carbs")),
            fat: n(fd.get("fat")),
          });
          if (r.error) setError(r.error);
          else onDone();
        });
      }}
    >
      <div className="text-sm font-medium">Add something extra</div>
      <p className="text-xs text-muted">For anything not in the plan, like a sauce, a drink or a bigger portion. Calories are enough; macros are optional.</p>
      <input name="name" placeholder="What was it? e.g. Extra rice" aria-label="What was it" className={inputCls} autoFocus />
      <div className="grid grid-cols-4 gap-2">
        {(
          [
            ["kcal", "kcal"],
            ["protein", "P (g)"],
            ["carbs", "C (g)"],
            ["fat", "F (g)"],
          ] as const
        ).map(([name, label]) => (
          <label key={name} className="text-xs text-muted">
            {label}
            <input name={name} type="number" inputMode="decimal" step="any" min="0" required={name === "kcal"} className={`${inputBase} w-full tabular-nums`} />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text disabled:opacity-60">
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" onClick={onDone} className="px-3 text-sm text-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function MealCard({ meal, editable }: { meal: MealView; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const [quick, setQuick] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = meal.target;
  const showPlan = meal.planned.length > 0 && meal.items.length === 0;

  return (
    <section className={`rounded-2xl border bg-surface ${meal.completed ? "border-accent/50" : "border-border"} ${pending ? "opacity-70" : ""}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h3 className="flex items-center gap-2 font-semibold">
          {meal.completed && (
            <span aria-label="Completed" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-accent-text">
              ✓
            </span>
          )}
          {meal.name}
        </h3>
        {editable && (
          <div className="flex items-center gap-3 text-sm">
            {meal.planHasFoods && meal.items.length > 0 && !meal.completed && (
              <button type="button" onClick={() => start(() => fillMealFromPlan(meal.id))} className="text-accent hover:underline" title="Add any planned foods that aren't logged yet">
                Add planned foods
              </button>
            )}
            {!meal.fromPlan && (
              <button
                type="button"
                onClick={() => confirm(`Remove ${meal.name}?`) && start(() => removeMeal(meal.id))}
                className="text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </header>
      {meal.planNotes && <p className="px-4 pt-1 text-xs text-muted">{meal.planNotes}</p>}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-b border-border px-4 pb-3 text-xs">
        <span className="text-muted">{t ? "Logged / planned:" : "Logged:"}</span>
        <span><Ratio v={meal.logged.kcal} t={t?.kcal} unit=" kcal" round strict={meal.completed} /></span>
        <span>P <Ratio v={meal.logged.protein} t={t?.protein} unit="g" strict={meal.completed} /></span>
        <span>C <Ratio v={meal.logged.carbs} t={t?.carbs} unit="g" strict={meal.completed} /></span>
        <span>F <Ratio v={meal.logged.fat} t={t?.fat} unit="g" strict={meal.completed} /></span>
        {t && meal.items.length > 0 && <Variance logged={meal.logged} target={t} />}
      </div>
      {showPlan && (
        <div className="px-4 pt-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{editable ? "Your plan for this meal" : "Planned"}</div>
          <ul className="divide-y divide-border rounded-lg bg-surface-2">
            {meal.planned.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block break-words leading-snug">{p.name}</span>
                  <span className="block text-xs text-muted">{fmtMacro(p.qty)} {p.unit}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{Math.round(p.kcal)} kcal</span>
              </li>
            ))}
          </ul>
          {editable && (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => eatMealAsPlanned(meal.id))}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-text hover:opacity-90 disabled:opacity-60"
              >
                ✓ I ate this as planned
              </button>
              <p className="text-center text-xs text-muted">Ate something different? Tick it, then change amounts or add extras below.</p>
            </div>
          )}
        </div>
      )}
      {!showPlan && <div className={`${COLS} px-4 pt-2 text-[11px] uppercase tracking-wide text-muted`}>
        <span>Food</span>
        <span className="text-right">kcal</span>
        <span className="text-right">P</span>
        <span className="text-right">C</span>
        <span className="text-right">F</span>
      </div>}
      <ul>
        {meal.items.map((it) => (
          <li key={it.id} className={`${COLS} border-b border-border px-4 py-2 last:border-0`}>
            <div className="min-w-0">
              <div className="break-words text-sm leading-snug">{it.name}</div>
              {editingId === it.id ? (
                <form
                  className="mt-1 flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = Number(new FormData(e.currentTarget).get("qty"));
                    if (q > 0) start(async () => { await updateMealItemQty(it.id, q); setEditingId(null); });
                  }}
                >
                  <input name="qty" type="number" step="any" min="0" defaultValue={it.qty} autoFocus aria-label="Amount" className={`${inputBase} w-20 py-1`} />
                  <span className="text-xs text-muted">{it.unit}</span>
                  <button className="ml-1 text-xs font-medium text-accent">Save</button>
                  <button type="button" onClick={() => start(() => removeMealItem(it.id))} className="ml-1 text-xs text-muted hover:text-danger">
                    Delete
                  </button>
                </form>
              ) : editable ? (
                <button type="button" onClick={() => setEditingId(it.id)} className="text-xs text-muted hover:text-accent" title="Edit amount">
                  {fmtMacro(it.qty)} {it.unit} · edit
                </button>
              ) : (
                <div className="text-xs text-muted">{fmtMacro(it.qty)} {it.unit}</div>
              )}
            </div>
            <span className="text-right text-sm tabular-nums">{Math.round(it.kcal)}</span>
            <span className="text-right text-sm tabular-nums">{fmtMacro(it.protein)}</span>
            <span className="text-right text-sm tabular-nums">{fmtMacro(it.carbs)}</span>
            <span className="text-right text-sm tabular-nums">{fmtMacro(it.fat)}</span>
          </li>
        ))}
        {meal.items.length === 0 && !showPlan && <li className="px-4 py-3 text-sm text-muted">Nothing logged yet.</li>}
      </ul>

      {editable && (
        <div className="space-y-3 px-4 pb-4 pt-2">
          {adding ? (
            <FoodPicker onAdd={(foodId, qty) => addMealItem(meal.id, foodId, qty)} onClose={() => setAdding(false)} />
          ) : quick ? (
            <QuickAdd mealId={meal.id} onDone={() => setQuick(false)} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-4">
                <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-accent">
                  + Add food
                </button>
                <button type="button" onClick={() => setQuick(true)} className="text-sm font-medium text-accent">
                  + Extra calories
                </button>
              </div>
              {!showPlan && <button
                type="button"
                onClick={() => start(() => toggleMealComplete(meal.id))}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  meal.completed ? "bg-accent-soft text-accent" : "border border-border hover:bg-surface-2"
                }`}
              >
                {meal.completed ? "Completed ✓" : "Mark complete"}
              </button>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function DayActions({ date, completed }: { date: string; completed: boolean }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await addMeal(date, name);
            setName("");
          });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name, e.g. Pre-workout" aria-label="New meal name" className={inputCls} />
        <button disabled={pending} className="shrink-0 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2">
          + Add meal
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => toggleDayComplete(date))}
          className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold ${
            completed ? "bg-accent-soft text-accent" : "bg-accent text-accent-text hover:opacity-90"
          }`}
        >
          {completed ? "Day completed ✓ (tap to reopen)" : "Complete day"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await copyPreviousDay(date);
              setMsg(r?.error ?? r?.ok ?? null);
            })
          }
          className="rounded-lg border border-border px-3 py-3 text-sm hover:bg-surface-2"
        >
          Copy last logged day
        </button>
      </div>
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
    </div>
  );
}
