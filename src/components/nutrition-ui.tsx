"use client";

import { useState, useTransition } from "react";
import {
  addMeal,
  addMealItem,
  copyPreviousDay,
  fillMealFromPlan,
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

export function MealCard({ meal, editable }: { meal: MealView; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = meal.target;

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
            {meal.planHasFoods && (
              <button type="button" onClick={() => start(() => fillMealFromPlan(meal.id))} className="text-accent hover:underline" title="Add the foods your coach planned for this meal">
                Use plan
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
      </div>
      <div className={`${COLS} px-4 pt-2 text-[11px] uppercase tracking-wide text-muted`}>
        <span>Food</span>
        <span className="text-right">kcal</span>
        <span className="text-right">P</span>
        <span className="text-right">C</span>
        <span className="text-right">F</span>
      </div>
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
        {meal.items.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing logged yet.</li>}
      </ul>

      {editable && (
        <div className="space-y-3 px-4 pb-4 pt-2">
          {adding ? (
            <FoodPicker onAdd={(foodId, qty) => addMealItem(meal.id, foodId, qty)} onClose={() => setAdding(false)} />
          ) : (
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-accent">
                + Add food
              </button>
              <button
                type="button"
                onClick={() => start(() => toggleMealComplete(meal.id))}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  meal.completed ? "bg-accent-soft text-accent" : "border border-border hover:bg-surface-2"
                }`}
              >
                {meal.completed ? "Completed ✓" : "Mark complete"}
              </button>
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
