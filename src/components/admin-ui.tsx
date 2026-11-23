"use client";

import { useActionState, useState, useTransition } from "react";
import {
  adminDeleteFood,
  adminDeleteUser,
  adminMoveClient,
  adminNewInviteCode,
  adminResetPassword,
  adminSetSuspended,
  adminUpdateFood,
  adminUpdateUser,
} from "@/app/admin-actions";
import { fmtMacro } from "@/lib/macros";
import { inputCls } from "./ui";

type Result = { ok?: string; error?: string; tempPassword?: string } | undefined;

function Status({ r }: { r: Result }) {
  if (!r || (!r.ok && !r.error)) return null;
  return (
    <p role="status" className={`text-sm ${r.error ? "text-danger" : "text-accent"}`}>
      {r.error ?? r.ok}
    </p>
  );
}

const btn = "rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";
const primary = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-60";

function useAction() {
  const [r, setR] = useState<Result>(undefined);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      try {
        setR(await fn());
      } catch (e) {
        setR({ error: (e as Error).message });
      }
    });
  return { r, pending, run };
}

export function ResetPassword({ userId, name }: { userId: string; name: string }) {
  const { r, pending, run } = useAction();
  const [copied, setCopied] = useState(false);
  if (r?.tempPassword) {
    return (
      <div className="space-y-2 text-sm">
        <p>Send this temporary password to {name} privately. They&apos;ll choose a new one when they log in. It won&apos;t be shown again.</p>
        <div className="flex items-center gap-2">
          <code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-base font-semibold">{r.tempPassword}</code>
          <button type="button" className={btn} onClick={async () => { await navigator.clipboard?.writeText(r.tempPassword!); setCopied(true); }}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Gives {name} a temporary password and signs them out everywhere.</p>
      <button type="button" disabled={pending} className={btn} onClick={() => confirm(`Reset ${name}'s password?`) && run(() => adminResetPassword(userId))}>
        {pending ? "Resetting…" : "Reset password"}
      </button>
      <Status r={r} />
    </div>
  );
}

export function Suspend({ userId, name, suspended }: { userId: string; name: string; suspended: boolean }) {
  const { r, pending, run } = useAction();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        {suspended ? `${name} can't log in. Their data is kept.` : `Stops ${name} logging in without deleting anything. You can undo it any time.`}
      </p>
      <button
        type="button"
        disabled={pending}
        className={btn}
        onClick={() => (suspended || confirm(`Suspend ${name}?`)) && run(() => adminSetSuspended(userId, !suspended))}
      >
        {suspended ? "Unsuspend account" : "Suspend account"}
      </button>
      <Status r={r} />
    </div>
  );
}

export function MoveClient({ userId, current, coaches }: { userId: string; current: string | null; coaches: { id: string; name: string }[] }) {
  const { r, pending, run } = useAction();
  const [to, setTo] = useState(coaches.find((c) => c.id !== current)?.id ?? "");
  const options = coaches.filter((c) => c.id !== current);
  if (!options.length) return <p className="text-sm text-muted">There&apos;s no other coach to move them to.</p>;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Move to coach" className={inputCls}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" disabled={pending} className={`${btn} shrink-0`} onClick={() => run(() => adminMoveClient(userId, to))}>
          Move
        </button>
      </div>
      <p className="text-xs text-muted">Their meal plan and history move with them.</p>
      <Status r={r} />
    </div>
  );
}

export function EditUser({ userId, name, email }: { userId: string; name: string; email: string }) {
  const { r, pending, run } = useAction();
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => adminUpdateUser(userId, { name: String(fd.get("name")), email: String(fd.get("email")) }));
      }}
    >
      <label className="text-xs font-medium text-muted">
        Name
        <input name="name" defaultValue={name} required className={`${inputCls} mt-1`} />
      </label>
      <label className="text-xs font-medium text-muted">
        Email (used to log in)
        <input name="email" type="email" defaultValue={email} required className={`${inputCls} mt-1`} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save"}
        </button>
        <Status r={r} />
      </div>
    </form>
  );
}

export function InviteCode({ userId, code }: { userId: string; code: string | null }) {
  const { r, pending, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">Invite code</span>
      <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono font-semibold">{code ?? "–"}</code>
      <button
        type="button"
        disabled={pending}
        className="text-sm text-accent"
        onClick={() => confirm("Make a new invite code? The old one stops working.") && run(() => adminNewInviteCode(userId))}
      >
        New code
      </button>
      <Status r={r} />
    </div>
  );
}

export function DeleteUser({ userId, name, email, hasClients }: { userId: string; name: string; email: string; hasClients: boolean }) {
  const { r, pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  if (hasClients) return <p className="text-sm text-muted">To delete {name}, first move their clients to another coach.</p>;
  if (!open) {
    return (
      <button type="button" className="rounded-lg border border-danger/40 px-3 py-2 text-sm font-medium text-danger hover:bg-surface-2" onClick={() => setOpen(true)}>
        Delete account…
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-danger/40 p-3">
      <p className="text-sm">
        This permanently deletes {name} and everything they logged: check-ins, photos records, food, workouts and messages. It can&apos;t be undone.
      </p>
      <label className="block text-xs text-muted">
        Type <span className="font-mono">{email}</span> to confirm
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="none" className={`${inputCls} mt-1`} />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || typed.trim().toLowerCase() !== email}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          onClick={() => run(() => adminDeleteUser(userId, typed))}
        >
          {pending ? "Deleting…" : "Delete forever"}
        </button>
        <button type="button" className="px-3 text-sm text-muted" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <Status r={r} />
    </div>
  );
}

type FoodView = {
  id: string; name: string; brand: string | null; baseQty: number; unit: string; kcal: number; protein: number;
  carbs: number; fat: number; servingQty: number | null; barcode: string | null; origin: string;
};

export function FoodRow({ food }: { food: FoodView }) {
  const [open, setOpen] = useState(false);
  const [state, action, saving] = useActionState(adminUpdateFood, undefined);
  const del = useAction();
  if (del.r?.ok) return null;
  const field = (name: keyof FoodView, label: string, type = "number") => (
    <label className="text-xs text-muted">
      {label}
      <input
        name={name}
        type={type}
        step="any"
        min={type === "number" ? "0" : undefined}
        defaultValue={(food[name] as string | number | null) ?? ""}
        className={`${inputCls} mt-1 tabular-nums`}
      />
    </label>
  );
  return (
    <li className="py-2">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-sm">{food.name}</span>
          <span className="block truncate text-xs text-muted">
            {food.brand && `${food.brand} · `}per {fmtMacro(food.baseQty)} {food.unit} · {food.origin}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs tabular-nums text-muted">
          {fmtMacro(food.kcal)} kcal
          <br />P{fmtMacro(food.protein)} C{fmtMacro(food.carbs)} F{fmtMacro(food.fat)}
        </span>
      </button>
      {open && (
        <form action={action} className="mt-3 space-y-3 rounded-xl bg-surface-2 p-3">
          <input type="hidden" name="id" value={food.id} />
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">{field("name", "Name", "text")}</div>
            <div className="col-span-2">{field("brand", "Brand", "text")}</div>
            {field("baseQty", "Nutrition per")}
            {field("unit", "Unit", "text")}
            {field("kcal", "Calories")}
            {field("protein", "Protein (g)")}
            {field("carbs", "Carbs (g)")}
            {field("fat", "Fat (g)")}
            {field("servingQty", "Default serving")}
          </div>
          {food.barcode && <p className="text-xs text-muted">Barcode {food.barcode}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={saving} className={primary}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={del.pending}
              className="text-sm text-danger"
              onClick={() => confirm(`Delete ${food.name}? Meals already logged keep their numbers.`) && del.run(() => adminDeleteFood(food.id))}
            >
              Delete food
            </button>
          </div>
          <Status r={state} />
          <Status r={del.r} />
        </form>
      )}
    </li>
  );
}
