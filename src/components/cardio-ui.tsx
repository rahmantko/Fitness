"use client";

import { useActionState, useTransition } from "react";
import { logCardio, removeCardio } from "@/app/nutrition-actions";
import { inputCls } from "./ui";

const ACTIVITIES = ["Stair climber", "Incline treadmill walk", "Walk", "Run", "Bike", "Rower", "Elliptical", "Swim", "HIIT"];

export function CardioForm({ date }: { date: string }) {
  const [state, action, pending] = useActionState(logCardio, undefined);
  const lbl = "mb-1 block text-xs font-medium text-muted";
  return (
    <form action={action} className="space-y-3">
      <datalist id="cardio-activities">
        {ACTIVITIES.map((a) => <option key={a} value={a} />)}
      </datalist>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2">
          <span className={lbl}>Activity</span>
          <input name="activity" list="cardio-activities" required placeholder="e.g. Stair climber" className={inputCls} />
        </label>
        <label className="col-span-2 sm:col-span-1">
          <span className={lbl}>Date</span>
          <input name="date" type="date" required defaultValue={date} className={inputCls} />
        </label>
        <label>
          <span className={lbl}>Minutes</span>
          <input name="durationMin" type="number" inputMode="numeric" min="0" className={inputCls} />
        </label>
        <label>
          <span className={lbl}>Distance (km)</span>
          <input name="distanceKm" type="number" inputMode="decimal" step="any" min="0" className={inputCls} />
        </label>
        <label>
          <span className={lbl}>Avg heart rate</span>
          <input name="avgHr" type="number" inputMode="numeric" min="0" className={inputCls} />
        </label>
        <label>
          <span className={lbl}>Calories burned</span>
          <input name="kcal" type="number" inputMode="numeric" min="0" className={inputCls} />
        </label>
        <label className="col-span-2 sm:col-span-3">
          <span className={lbl}>Notes</span>
          <input name="notes" placeholder="Optional" className={inputCls} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text disabled:opacity-60">
          {pending ? "Saving…" : "Log cardio"}
        </button>
        {state && <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>{state.error ?? state.ok}</p>}
      </div>
    </form>
  );
}

export function RemoveCardioButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => removeCardio(id))} aria-label="Delete entry" className="text-muted hover:text-danger">
      ×
    </button>
  );
}
