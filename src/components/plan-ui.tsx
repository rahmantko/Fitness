"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addPlanItem,
  addPlanMeal,
  copyPlan,
  copyPlanFromClient,
  movePlanMeal,
  removePlanItem,
  removePlanMeal,
  saveCardioPlan,
  updatePlanItemQty,
  updatePlanMeal,
} from "@/app/nutrition-actions";
import type { DayType } from "@/db/schema";
import { fmtMacro, type Macros } from "@/lib/macros";
import { FoodPicker } from "./food-picker";
import { inputBase, inputCls } from "./ui";

export type PlanMealView = {
  id: string;
  name: string;
  notes: string | null;
  target: Macros;
  items: { id: string; qty: number; foodName: string; unit: string; macros: Macros }[];
};

function MacroLine({ m }: { m: Macros }) {
  return (
    <span className="tabular-nums text-muted">
      {Math.round(m.kcal)} kcal · P {fmtMacro(m.protein)} · C {fmtMacro(m.carbs)} · F {fmtMacro(m.fat)}
    </span>
  );
}

export function PlanMealEditor({
  meal,
  clientId,
  editable,
  first,
  last,
}: {
  meal: PlanMealView;
  clientId: string;
  editable: boolean;
  first: boolean;
  last: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 ${pending ? "opacity-70" : ""}`}>
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              await updatePlanMeal(meal.id, String(fd.get("name")), String(fd.get("notes")));
              setEditing(false);
            });
          }}
        >
          <input name="name" defaultValue={meal.name} aria-label="Meal name" className={inputCls} />
          <input name="notes" defaultValue={meal.notes ?? ""} placeholder="Note for the client (optional), e.g. eat within 1 hour of training" aria-label="Meal notes" className={inputCls} />
          <div className="flex gap-3 text-sm">
            <button className="font-medium text-accent">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-muted">Cancel</button>
          </div>
        </form>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{meal.name}</h3>
            <div className="text-xs"><MacroLine m={meal.target} /></div>
            {meal.notes && <p className="mt-1 text-xs text-muted">{meal.notes}</p>}
          </div>
          {editable && (
            <div className="flex items-center gap-1 text-sm">
              <button type="button" disabled={first} onClick={() => start(() => movePlanMeal(meal.id, -1))} aria-label="Move up" className="px-1.5 text-muted hover:text-text disabled:opacity-30">↑</button>
              <button type="button" disabled={last} onClick={() => start(() => movePlanMeal(meal.id, 1))} aria-label="Move down" className="px-1.5 text-muted hover:text-text disabled:opacity-30">↓</button>
              <button type="button" onClick={() => setEditing(true)} className="px-1.5 text-muted hover:text-text">Edit</button>
              <button type="button" onClick={() => confirm(`Delete ${meal.name} from the plan?`) && start(() => removePlanMeal(meal.id))} className="px-1.5 text-muted hover:text-danger">Delete</button>
            </div>
          )}
        </header>
      )}

      <ul className="mt-3 divide-y divide-border">
        {meal.items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate">{it.foodName}</div>
              <div className="text-xs"><MacroLine m={it.macros} /></div>
            </div>
            {editable ? (
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={it.qty}
                  aria-label={`${it.foodName} amount`}
                  onBlur={(e) => {
                    const q = Number(e.target.value);
                    if (q > 0 && q !== it.qty) start(() => updatePlanItemQty(it.id, q));
                  }}
                  className={`${inputBase} w-20 py-1 text-right`}
                />
                <span className="w-10 text-xs text-muted">{it.unit}</span>
                <button type="button" onClick={() => start(() => removePlanItem(it.id))} aria-label={`Remove ${it.foodName}`} className="px-1 text-muted hover:text-danger">×</button>
              </div>
            ) : (
              <span className="shrink-0 tabular-nums text-muted">{fmtMacro(it.qty)} {it.unit}</span>
            )}
          </li>
        ))}
        {meal.items.length === 0 && <li className="py-2 text-sm text-muted">No foods planned.</li>}
      </ul>

      {editable && (
        <div className="mt-2">
          {adding ? (
            <FoodPicker clientId={clientId} onAdd={(foodId, qty) => addPlanItem(meal.id, foodId, qty)} onClose={() => setAdding(false)} />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="text-sm font-medium text-accent">+ Add food</button>
          )}
        </div>
      )}
    </section>
  );
}

export function PlanToolbar({ clientId, dayType, otherHasMeals }: { clientId: string; dayType: DayType; otherHasMeals: boolean }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const other = dayType === "training" ? "rest" : "training";
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            await addPlanMeal(clientId, dayType, name);
            setName("");
          });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name, e.g. Meal 1 or Post-workout" aria-label="New meal name" className={inputCls} />
        <button disabled={pending} className="shrink-0 rounded-lg bg-accent px-3 text-sm font-medium text-accent-text disabled:opacity-60">
          + Add meal
        </button>
      </form>
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirm(`Replace the ${other} day plan with a copy of this ${dayType} day plan?`) && start(() => copyPlan(clientId, dayType))
          }
          className="text-muted underline hover:text-text"
        >
          Copy this plan to {other} days{otherHasMeals ? " (replaces it)" : ""}
        </button>
      </div>
    </div>
  );
}

/** Coach: start this client's plan from another client's plan, then tweak it. */
export function CopyFromClient({ clientId, clientName, others }: { clientId: string; clientName: string; others: { id: string; name: string }[] }) {
  const [from, setFrom] = useState(others[0]?.id ?? "");
  const [opts, setOpts] = useState({ training: true, rest: true, cardio: true });
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  if (others.length === 0) {
    return <p className="text-sm text-muted">Once you have more clients, you can copy a plan from one of them here.</p>;
  }
  const fromName = others.find((o) => o.id === from)?.name ?? "";
  const box = (key: keyof typeof opts, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(`Replace ${clientName}'s plan with a copy of ${fromName}'s? You can edit it afterwards.`)) return;
        start(async () => setMsg(await copyPlanFromClient(clientId, from, opts)));
      }}
    >
      <p className="text-sm text-muted">Copy a plan you&apos;ve already built, then adjust the amounts for {clientName}.</p>
      <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Copy from client" className={inputCls}>
        {others.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {box("training", "Training day meals")}
        {box("rest", "Rest day meals")}
        {box("cardio", "Cardio & steps plan")}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.error ? "text-danger" : "text-accent"}`}>{msg.error ?? msg.ok}</p>}
      <button disabled={pending} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-60">
        {pending ? "Copying…" : `Copy from ${fromName}`}
      </button>
    </form>
  );
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function CardioPlanForm({ clientId, plan }: { clientId: string; plan: Record<number, string> }) {
  const [state, action, pending] = useActionState(saveCardioPlan, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      {WEEKDAYS.map((d, i) => (
        <label key={d} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
          <span className="text-sm text-muted">{d}</span>
          <input name={`day${i}`} defaultValue={plan[i] ?? ""} placeholder="e.g. 30 min stair climber, or 10k steps" className={inputCls} />
        </label>
      ))}
      <div className="flex items-center gap-3 pt-1">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text disabled:opacity-60">
          {pending ? "Saving…" : "Save cardio plan"}
        </button>
        {state && <p className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>{state.error ?? state.ok}</p>}
      </div>
    </form>
  );
}
