"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addBloodTest,
  createCheckin,
  importSteps,
  logWorkout,
  login,
  saveDailyLog,
  saveFeedback,
  saveTargets,
  signup,
  type FormState,
} from "@/app/actions";
import { Field, inputCls } from "./ui";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

function Num(props: { name: string; label: string; step?: string; defaultValue?: number | null; placeholder?: string }) {
  return (
    <Field label={props.label}>
      <input
        name={props.name}
        type="number"
        inputMode="decimal"
        step={props.step ?? "any"}
        min="0"
        defaultValue={props.defaultValue ?? undefined}
        placeholder={props.placeholder}
        className={inputCls}
      />
    </Field>
  );
}

function DateInput({ defaultValue }: { defaultValue: string }) {
  return (
    <Field label="Date">
      <input name="date" type="date" required defaultValue={defaultValue} className={inputCls} />
    </Field>
  );
}

// ---------- Auth ----------

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" defaultValue={state?.email} key={state?.email} className={inputCls} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      <a href="/forgot-password" className="-mt-2 block text-right text-xs text-muted hover:text-accent">
        Forgot password?
      </a>
      <Message state={state} />
      <Submit>Log in</Submit>
    </form>
  );
}

export function SignupForm({ code }: { code?: string }) {
  const [state, action] = useActionState(signup, undefined);
  const [role, setRole] = useState<"client" | "coach">("client");
  const invited = !!code;
  return (
    <form action={action} className="space-y-4">
      {invited && <input type="hidden" name="role" value="client" />}
      {!invited && (
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-medium text-muted">I am a</legend>
        {(["client", "coach"] as const).map((r) => (
          <label
            key={r}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm capitalize ${
              role === r ? "border-accent bg-accent-soft font-medium" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={r}
              checked={role === r}
              onChange={() => setRole(r)}
              className="sr-only"
            />
            {r}
          </label>
        ))}
      </fieldset>
      )}
      <Field label="Name">
        <input name="name" required autoComplete="name" className={inputCls} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputCls} />
      </Field>
      {role === "client" && (
        <Field label="Coach invite code" hint="Your coach can find this on their dashboard">
          <input name="inviteCode" required defaultValue={code} readOnly={invited} className={`${inputCls} uppercase ${invited ? "bg-surface-2" : ""}`} />
        </Field>
      )}
      <Message state={state} />
      <Submit>Create account</Submit>
    </form>
  );
}

// ---------- Daily log ----------

export function DailyLogForm({
  date,
  existing,
}: {
  date: string;
  existing?: {
    weightKg: number | null;
    steps: number | null;
    notes: string | null;
  };
}) {
  const [state, action] = useActionState(saveDailyLog, undefined);
  return (
    <form action={action} className="space-y-3" key={date}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <DateInput defaultValue={date} />
        </div>
        <Num name="weightKg" label="Weight (kg)" step="0.1" defaultValue={existing?.weightKg} />
        <Num name="steps" label="Steps" step="1" defaultValue={existing?.steps} />
      </div>
      <Field label="Notes">
        <input name="notes" defaultValue={existing?.notes ?? ""} className={inputCls} placeholder="Optional" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit>Save day</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

export function StepsForm({ date, steps }: { date: string; steps?: number | null }) {
  const [state, action] = useActionState(saveDailyLog, undefined);
  return (
    <form action={action} className="space-y-3" key={`${date}-${steps}`}>
      <div className="grid grid-cols-2 gap-3">
        <DateInput defaultValue={date} />
        <Num name="steps" label="Steps" step="1" defaultValue={steps} />
      </div>
      <div className="flex items-center gap-3">
        <Submit>Save steps</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

export function StepsImportForm() {
  const [state, action] = useActionState(importSteps, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="CSV file" hint="One row per day: date,steps (e.g. 2026-11-01,8450). Most step apps can export this.">
        <input name="file" type="file" accept=".csv,text/csv" required className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1`} />
      </Field>
      <div className="flex items-center gap-3">
        <Submit>Import steps</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

// ---------- Check-ins ----------

function Rating({ name, label }: { name: string; label: string }) {
  return (
    <Field label={`${label} (1–10)`}>
      <select name={name} defaultValue="" className={inputCls}>
        <option value="">–</option>
        {Array.from({ length: 10 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PhotoInput({ pose }: { pose: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs font-medium capitalize text-muted">{pose}</span>
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-2 text-xs text-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${pose} preview`} className="h-full w-full object-cover" />
        ) : (
          "Add photo"
        )}
      </div>
      <input
        type="file"
        name={`photo_${pose}`}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
    </label>
  );
}

export function CheckinForm({ date, lastWeight }: { date: string; lastWeight?: number | null }) {
  const [state, action] = useActionState(createCheckin, undefined);
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DateInput defaultValue={date} />
        <Num name="weightKg" label="Weight (kg)" step="0.1" defaultValue={lastWeight} />
        <Num name="bodyFatPct" label="Body fat (%)" step="0.1" />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Measurements (cm)</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Num name="waistCm" label="Waist" step="0.1" />
          <Num name="chestCm" label="Chest" step="0.1" />
          <Num name="hipsCm" label="Hips" step="0.1" />
          <Num name="armCm" label="Arm" step="0.1" />
          <Num name="thighCm" label="Thigh" step="0.1" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Progress photos</h3>
        <div className="grid grid-cols-3 gap-3">
          <PhotoInput pose="front" />
          <PhotoInput pose="side" />
          <PhotoInput pose="back" />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">How did the week go?</h3>
        <div className="grid grid-cols-3 gap-3">
          <Rating name="energy" label="Energy" />
          <Rating name="sleep" label="Sleep" />
          <Rating name="adherence" label="Plan adherence" />
        </div>
      </div>
      <Field label="Notes for your coach">
        <textarea name="notes" rows={4} className={inputCls} placeholder="Wins, struggles, questions…" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit>Submit check-in</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

export function FeedbackForm({ checkinId, feedback }: { checkinId: string; feedback: string | null }) {
  const [state, action] = useActionState(saveFeedback, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="checkinId" value={checkinId} />
      <textarea
        name="feedback"
        rows={3}
        defaultValue={feedback ?? ""}
        className={inputCls}
        placeholder="Feedback for your client…"
      />
      <div className="flex items-center gap-3">
        <Submit>Save feedback</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

// ---------- Targets ----------

export function TargetsForm({
  clientId,
  t,
}: {
  clientId: string;
  t?: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    steps: number | null;
    goalWeightKg: number | null;
  };
}) {
  const [state, action] = useActionState(saveTargets, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Num name="calories" label="Calories" step="1" defaultValue={t?.calories} />
        <Num name="protein" label="Protein (g)" step="1" defaultValue={t?.protein} />
        <Num name="carbs" label="Carbs (g)" step="1" defaultValue={t?.carbs} />
        <Num name="fat" label="Fat (g)" step="1" defaultValue={t?.fat} />
        <Num name="steps" label="Daily steps" step="1" defaultValue={t?.steps} />
        <Num name="goalWeightKg" label="Goal weight (kg)" step="0.1" defaultValue={t?.goalWeightKg} />
      </div>
      <div className="flex items-center gap-3">
        <Submit>Save targets</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

// ---------- Training ----------

type SetRow = { id: number; exercise: string };

export function WorkoutForm({ date, exercises }: { date: string; exercises: string[] }) {
  const [state, action] = useActionState(logWorkout, undefined);
  const [rows, setRows] = useState<SetRow[]>([{ id: 1, exercise: "" }]);
  const nextId = () => Math.max(0, ...rows.map((r) => r.id)) + 1;

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DateInput defaultValue={date} />
        <Field label="Session">
          <input name="name" required placeholder="e.g. Upper A" className={inputCls} />
        </Field>
      </div>
      <datalist id="exercise-list">
        {exercises.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_4rem_5rem_4rem_2rem] gap-2 text-xs font-medium text-muted">
          <span>Exercise</span>
          <span>Reps</span>
          <span>kg</span>
          <span>RPE</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_4rem_5rem_4rem_2rem] gap-2">
            <input
              name="exercise"
              list="exercise-list"
              defaultValue={r.exercise}
              onChange={(e) => (r.exercise = e.target.value)}
              placeholder="Exercise"
              aria-label={`Set ${i + 1} exercise`}
              className={inputCls}
            />
            <input name="reps" type="number" inputMode="numeric" min="0" aria-label="Reps" className={inputCls} />
            <input name="weight" type="number" inputMode="decimal" step="any" min="0" aria-label="Weight in kg" className={inputCls} />
            <input name="rpe" type="number" inputMode="decimal" step="0.5" min="1" max="10" aria-label="RPE" className={inputCls} />
            <button
              type="button"
              onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
              disabled={rows.length === 1}
              aria-label="Remove set"
              className="text-muted hover:text-danger disabled:opacity-30"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows([...rows, { id: nextId(), exercise: rows.at(-1)?.exercise ?? "" }])}
          className="text-sm font-medium text-accent"
        >
          + Add set
        </button>
      </div>
      <Field label="Notes">
        <input name="notes" className={inputCls} placeholder="Optional" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit>Log workout</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}

// ---------- Blood work ----------

const COMMON_MARKERS = [
  "Total testosterone",
  "Free testosterone",
  "Oestradiol",
  "SHBG",
  "LH",
  "FSH",
  "TSH",
  "Free T4",
  "Free T3",
  "HbA1c",
  "Fasting glucose",
  "Total cholesterol",
  "LDL",
  "HDL",
  "Triglycerides",
  "ALT",
  "AST",
  "Creatinine",
  "eGFR",
  "Haemoglobin",
  "Haematocrit",
  "Ferritin",
  "Vitamin D",
  "Vitamin B12",
  "CRP",
];

export function BloodTestForm({ date }: { date: string }) {
  const [state, action] = useActionState(addBloodTest, undefined);
  const [rows, setRows] = useState([1, 2, 3]);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DateInput defaultValue={date} />
        <Field label="Lab">
          <input name="lab" className={inputCls} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Lab report (PDF or photo)">
        <input
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1`}
        />
      </Field>
      <datalist id="marker-list">
        {COMMON_MARKERS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 text-xs font-medium text-muted sm:grid-cols-[1fr_5rem_5rem_5rem_5rem]">
          <span>Marker</span>
          <span>Value</span>
          <span>Unit</span>
          <span className="hidden sm:block">Ref low</span>
          <span className="hidden sm:block">Ref high</span>
        </div>
        {rows.map((id) => (
          <div key={id} className="grid grid-cols-[1fr_5rem_5rem] gap-2 sm:grid-cols-[1fr_5rem_5rem_5rem_5rem]">
            <input name="marker" list="marker-list" placeholder="Marker" aria-label="Marker" className={inputCls} />
            <input name="value" type="number" step="any" aria-label="Value" className={inputCls} />
            <input name="unit" aria-label="Unit" placeholder="nmol/L" className={inputCls} />
            <input name="refLow" type="number" step="any" aria-label="Reference low" className={`${inputCls} hidden sm:block`} />
            <input name="refHigh" type="number" step="any" aria-label="Reference high" className={`${inputCls} hidden sm:block`} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows([...rows, Math.max(...rows) + 1])}
          className="text-sm font-medium text-accent"
        >
          + Add marker
        </button>
      </div>
      <Field label="Notes">
        <input name="notes" className={inputCls} placeholder="Optional" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit>Save blood test</Submit>
        <Message state={state} />
      </div>
    </form>
  );
}
