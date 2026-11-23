"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { appUrl, sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  users,
  targets,
  dailyLogs,
  checkins,
  photos,
  workouts,
  workoutSets,
  bloodTests,
  bloodMarkers,
  passwordResets,
} from "@/db/schema";
import { createSession, destroySession, requireUser, getViewableClient } from "@/lib/session";
import { saveFile } from "@/lib/storage";
import { int, isIsoDate, num, str } from "@/lib/format";

export type FormState = { error?: string; ok?: string; email?: string } | undefined;

// ---------- Auth ----------

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const name = str(form.get("name"));
  const email = str(form.get("email"))?.toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = form.get("role") === "coach" ? "coach" : "client";
  const code = str(form.get("inviteCode"))?.toUpperCase();

  if (!name || !email || !email.includes("@")) return { error: "Enter your name and a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const db = await getDb();
  let coachId: string | null = null;
  if (role === "client") {
    if (!code) return { error: "Enter the invite code your coach gave you." };
    const [coach] = await db.select().from(users).where(eq(users.inviteCode, code));
    if (!coach || coach.role !== "coach") return { error: "That invite code isn't valid." };
    coachId = coach.id;
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with that email already exists." };

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      coachId,
      inviteCode: role === "coach" ? randomBytes(4).toString("hex").toUpperCase() : null,
    })
    .returning();
  await createSession(user.id);
  redirect("/");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form.get("email"))?.toLowerCase() ?? "";
  const password = String(form.get("password") ?? "");
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email or password is incorrect.", email };
  }
  if (user.suspendedAt) return { error: "This account has been suspended. Contact your coach.", email };
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Helpers ----------

async function requireClientSelf() {
  const user = await requireUser();
  if (user.role !== "client") throw new Error("Only clients can log their own data.");
  return user;
}

async function requireCoachOf(clientId: string) {
  const user = await requireUser();
  if (user.role !== "coach") throw new Error("Only coaches can do this.");
  const client = await getViewableClient(user, clientId);
  if (!client) throw new Error("Client not found.");
  return { coach: user, client };
}

function dateOrToday(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return isIsoDate(s) ? s : new Date().toISOString().slice(0, 10);
}

// ---------- Daily log (weight, steps, nutrition) ----------

export async function saveDailyLog(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireClientSelf();
  const date = dateOrToday(form.get("date"));
  // Only fields present in the form are written, so a steps-only form never
  // wipes the weight or the nutrition totals that come from the food log.
  const all = {
    weightKg: () => num(form.get("weightKg")),
    steps: () => int(form.get("steps")),
    calories: () => int(form.get("calories")),
    protein: () => int(form.get("protein")),
    carbs: () => int(form.get("carbs")),
    fat: () => int(form.get("fat")),
    notes: () => str(form.get("notes")),
  };
  const values = Object.fromEntries(
    Object.entries(all)
      .filter(([k]) => form.has(k))
      .map(([k, f]) => [k, f()]),
  ) as Partial<{ [K in keyof typeof all]: ReturnType<(typeof all)[K]> }>;
  if (Object.keys(values).length === 0) return { error: "Nothing to save." };
  const db = await getDb();
  await db
    .insert(dailyLogs)
    .values({ clientId: user.id, date, ...values })
    .onConflictDoUpdate({ target: [dailyLogs.clientId, dailyLogs.date], set: values });
  revalidatePath(`/clients/${user.id}`, "layout");
  return { ok: `Saved ${date}.` };
}

export async function createCheckin(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireClientSelf();
  const db = await getDb();
  const uploads: { pose: "front" | "side" | "back"; file: File }[] = [];
  for (const pose of ["front", "side", "back"] as const) {
    const f = form.get(`photo_${pose}`);
    if (f instanceof File && f.size > 0) uploads.push({ pose, file: f });
  }
  let saved: { pose: "front" | "side" | "back"; fileKey: string }[];
  try {
    saved = await Promise.all(
      uploads.map(async (u) => ({ pose: u.pose, fileKey: await saveFile(user.id, u.file) })),
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  const [checkin] = await db
    .insert(checkins)
    .values({
      clientId: user.id,
      date: dateOrToday(form.get("date")),
      weightKg: num(form.get("weightKg")),
      bodyFatPct: num(form.get("bodyFatPct")),
      waistCm: num(form.get("waistCm")),
      chestCm: num(form.get("chestCm")),
      hipsCm: num(form.get("hipsCm")),
      armCm: num(form.get("armCm")),
      thighCm: num(form.get("thighCm")),
      energy: int(form.get("energy")),
      sleep: int(form.get("sleep")),
      adherence: int(form.get("adherence")),
      notes: str(form.get("notes")),
    })
    .returning();
  if (saved.length) await db.insert(photos).values(saved.map((s) => ({ ...s, checkinId: checkin.id })));
  revalidatePath(`/clients/${user.id}`, "layout");
  redirect(`/clients/${user.id}/checkins`);
}

// ---------- Targets ----------

export async function saveTargets(_: FormState, form: FormData): Promise<FormState> {
  const clientId = String(form.get("clientId"));
  await requireCoachOf(clientId);
  const values = {
    calories: int(form.get("calories")),
    protein: int(form.get("protein")),
    carbs: int(form.get("carbs")),
    fat: int(form.get("fat")),
    steps: int(form.get("steps")),
    goalWeightKg: num(form.get("goalWeightKg")),
    updatedAt: new Date(),
  };
  const db = await getDb();
  await db
    .insert(targets)
    .values({ clientId, ...values })
    .onConflictDoUpdate({ target: targets.clientId, set: values });
  revalidatePath(`/clients/${clientId}`, "layout");
  return { ok: "Targets saved." };
}

// ---------- Training ----------

export async function logWorkout(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireClientSelf();
  const name = str(form.get("name"));
  if (!name) return { error: "Give the session a name, e.g. Upper A." };
  const exercises = form.getAll("exercise").map((v) => str(v));
  const reps = form.getAll("reps");
  const weights = form.getAll("weight");
  const rpes = form.getAll("rpe");
  const sets: { exercise: string; reps: number | null; weightKg: number | null; rpe: number | null }[] = [];
  exercises.forEach((ex, i) => {
    if (ex) sets.push({ exercise: ex, reps: int(reps[i]), weightKg: num(weights[i]), rpe: num(rpes[i]) });
  });
  if (sets.length === 0) return { error: "Add at least one set." };

  const db = await getDb();
  const [w] = await db
    .insert(workouts)
    .values({ clientId: user.id, date: dateOrToday(form.get("date")), name, notes: str(form.get("notes")) })
    .returning();
  const counter = new Map<string, number>();
  await db.insert(workoutSets).values(
    sets.map((s) => {
      const n = (counter.get(s.exercise) ?? 0) + 1;
      counter.set(s.exercise, n);
      return { ...s, workoutId: w.id, setNumber: n };
    }),
  );
  revalidatePath(`/clients/${user.id}`, "layout");
  return { ok: `Logged ${name} with ${sets.length} sets.` };
}

// ---------- Blood work ----------

export async function addBloodTest(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireClientSelf();
  const names = form.getAll("marker").map((v) => str(v));
  const values = form.getAll("value");
  const units = form.getAll("unit");
  const lows = form.getAll("refLow");
  const highs = form.getAll("refHigh");
  const markers = names
    .map((name, i) => ({
      name,
      value: num(values[i]),
      unit: str(units[i]),
      refLow: num(lows[i]),
      refHigh: num(highs[i]),
    }))
    .filter((m): m is typeof m & { name: string; value: number } => !!m.name && m.value != null);

  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && markers.length === 0) return { error: "Upload the lab report or enter at least one marker." };

  let fileKey: string | null = null;
  if (hasFile) {
    try {
      fileKey = await saveFile(user.id, file);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  const db = await getDb();
  const [t] = await db
    .insert(bloodTests)
    .values({
      clientId: user.id,
      date: dateOrToday(form.get("date")),
      lab: str(form.get("lab")),
      notes: str(form.get("notes")),
      fileKey,
      fileName: hasFile ? file.name.slice(0, 200) : null,
    })
    .returning();
  if (markers.length) await db.insert(bloodMarkers).values(markers.map((m) => ({ ...m, testId: t.id })));
  revalidatePath(`/clients/${user.id}`, "layout");
  return { ok: "Blood test saved." };
}

// ---------- Coach: client management ----------

export async function regenerateInviteCode() {
  const user = await requireUser();
  if (user.role !== "coach") return;
  const db = await getDb();
  await db
    .update(users)
    .set({ inviteCode: randomBytes(4).toString("hex").toUpperCase() })
    .where(and(eq(users.id, user.id), eq(users.role, "coach")));
  revalidatePath("/");
}


// ---------- Passwords ----------

/** Readable temporary password, e.g. "kite-4827-mango". */
function temporaryPassword() {
  const words = ["apple", "bison", "cedar", "delta", "ember", "fjord", "grape", "heron", "igloo", "jolly", "kite", "lemon", "mango", "noble", "olive", "pearl", "quail", "raven", "sage", "tiger", "umber", "viola", "willow", "yarrow", "zebra"];
  const w = () => words[randomInt(words.length)];
  return `${w()}-${randomInt(1000, 10000)}-${w()}`;
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowTemporaryPassword: true });
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is incorrect." };
  if (next.length < 8) return { error: "Your new password must be at least 8 characters." };
  if (next !== confirm) return { error: "The new passwords don't match." };
  if (next === current) return { error: "Choose a password different from the current one." };
  const db = await getDb();
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false, passwordChangedAt: new Date() })
    .where(eq(users.id, user.id));
  // Other devices are signed out; keep this one signed in.
  await createSession(user.id);
  if (user.mustChangePassword) redirect("/");
  return { ok: "Password changed." };
}

export type ResetState = { error?: string; tempPassword?: string } | undefined;

/** Coach gives a client a temporary password; the client must change it after logging in. */
export async function resetClientPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const clientId = String(form.get("clientId"));
  const coach = await requireUser();
  if (coach.role !== "coach") return { error: "Only coaches can reset passwords." };
  const client = await getViewableClient(coach, clientId);
  if (!client) return { error: "Client not found." };
  const tempPassword = temporaryPassword();
  const db = await getDb();
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true, passwordChangedAt: new Date() })
    .where(and(eq(users.id, client.id), eq(users.coachId, coach.id)));
  return { tempPassword };
}

// ---------- Forgot password (email link) ----------

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form.get("email"))?.toLowerCase();
  if (!email || !email.includes("@")) return { error: "Enter your email address." };
  // Same answer whether or not the account exists, so the form can't be used to find accounts.
  const done: FormState = {
    ok: "If there's an account for that email, we've sent a link to reset the password. It works for 1 hour. Check your spam folder if it doesn't arrive.",
  };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return done;

  // At most 3 emails per account per hour.
  const recent = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, new Date(Date.now() - RESET_TTL_MS))));
  if (recent.length >= 3) return done;

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  const h = await headers();
  const link = `${appUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"))}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your Checkpoint password",
    text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset the password for your Checkpoint account.\n\nChoose a new password here: ${link}\n\nThis link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email and your password stays the same.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Someone (hopefully you) asked to reset the password for your Checkpoint account.</p><p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#2f6f4f;color:#fff;border-radius:8px;text-decoration:none">Choose a new password</a></p><p style="color:#5f665f;font-size:13px">This link works once and expires in 1 hour. If you didn't ask for this, ignore this email and your password stays the same.</p>`,
  });
  return done;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Checks a reset link without using it up (for showing the form or an "expired" message). */
export async function isResetTokenValid(token: string) {
  if (!token || token.length > 100) return false;
  const db = await getDb();
  const [row] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  return !!row;
}

export async function resetPasswordWithToken(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < 8) return { error: "Your new password must be at least 8 characters." };
  if (next !== confirm) return { error: "The passwords don't match." };
  const db = await getDb();
  // Mark the link used in the same step that checks it, so it can only ever work once.
  const [row] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.tokenHash, hashToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .returning();
  if (!row) return { error: "This reset link has expired or was already used. Request a new one." };
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false, passwordChangedAt: new Date() })
    .where(eq(users.id, row.userId));
  // Any other outstanding links for this account stop working too.
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.userId, row.userId), isNull(passwordResets.usedAt)));
  await createSession(row.userId);
  redirect("/");
}
