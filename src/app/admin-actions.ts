"use server";

import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { foods, planItems, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { num, str } from "@/lib/format";

type Result = { ok?: string; error?: string; tempPassword?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function target(userId: string) {
  const admin = await requireAdmin();
  if (!UUID.test(userId)) throw new Error("User not found.");
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new Error("User not found.");
  return { admin, u, db };
}

function done(userId?: string) {
  revalidatePath("/admin", "layout");
  if (userId) revalidatePath(`/clients/${userId}`, "layout");
}

function temporaryPassword() {
  const words = ["apple", "bison", "cedar", "delta", "ember", "fjord", "grape", "heron", "kite", "lemon", "mango", "noble", "olive", "pearl", "raven", "sage", "tiger", "viola", "willow", "zebra"];
  const w = () => words[randomInt(words.length)];
  return `${w()}-${randomInt(1000, 10000)}-${w()}`;
}

export async function adminResetPassword(userId: string): Promise<Result> {
  const { u, db } = await target(userId);
  const tempPassword = temporaryPassword();
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(tempPassword, 10), mustChangePassword: true, passwordChangedAt: new Date() })
    .where(eq(users.id, u.id));
  done();
  return { tempPassword };
}

export async function adminSetSuspended(userId: string, suspend: boolean): Promise<Result> {
  const { admin, u, db } = await target(userId);
  if (u.id === admin.id) return { error: "You can't suspend your own account." };
  await db
    .update(users)
    .set({ suspendedAt: suspend ? new Date() : null })
    .where(eq(users.id, u.id));
  done();
  return { ok: suspend ? `${u.name} is suspended and can't log in.` : `${u.name} can log in again.` };
}

export async function adminMoveClient(userId: string, coachId: string): Promise<Result> {
  const { u, db } = await target(userId);
  if (u.role !== "client") return { error: "Only clients have a coach." };
  if (!UUID.test(coachId)) return { error: "Pick a coach." };
  const [coach] = await db.select().from(users).where(and(eq(users.id, coachId), eq(users.role, "coach")));
  if (!coach) return { error: "Coach not found." };
  await db.update(users).set({ coachId: coach.id }).where(eq(users.id, u.id));
  done(u.id);
  return { ok: `${u.name} now belongs to ${coach.name}.` };
}

export async function adminUpdateUser(userId: string, input: { name: string; email: string }): Promise<Result> {
  const { u, db } = await target(userId);
  const name = input.name.trim().slice(0, 80);
  const email = input.email.trim().toLowerCase().slice(0, 200);
  if (!name) return { error: "Enter a name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  if (email !== u.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) return { error: "Another account already uses that email." };
  }
  await db.update(users).set({ name, email }).where(eq(users.id, u.id));
  done(u.id);
  return { ok: "Saved." };
}

export async function adminNewInviteCode(userId: string): Promise<Result> {
  const { u, db } = await target(userId);
  if (u.role !== "coach") return { error: "Only coaches have invite codes." };
  await db.update(users).set({ inviteCode: randomBytes(4).toString("hex").toUpperCase() }).where(eq(users.id, u.id));
  done();
  revalidatePath("/");
  return { ok: "New invite code made. The old one no longer works." };
}

export async function adminDeleteUser(userId: string, confirmEmail: string): Promise<Result> {
  const { admin, u, db } = await target(userId);
  if (u.id === admin.id) return { error: "You can't delete your own account here." };
  if (confirmEmail.trim().toLowerCase() !== u.email) return { error: "Type the account's email exactly to confirm." };
  if (u.role === "coach") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.coachId, u.id));
    if (n > 0) return { error: `${u.name} still has ${n} client${n === 1 ? "" : "s"}. Move them to another coach first.` };
  }
  // Everything the user logged (check-ins, food, plans, comments…) is removed with them.
  await db.delete(users).where(eq(users.id, u.id));
  revalidatePath("/admin", "layout");
  redirect("/admin/users");
}

// ---------- Food library ----------

export async function adminUpdateFood(_: Result | undefined, form: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(form.get("id"));
  if (!UUID.test(id)) return { error: "Food not found." };
  const name = str(form.get("name"))?.slice(0, 120);
  const unit = str(form.get("unit"))?.slice(0, 20);
  const baseQty = num(form.get("baseQty"));
  const kcal = num(form.get("kcal"));
  if (!name || !unit || !(baseQty && baseQty > 0) || kcal == null || kcal < 0) return { error: "Name, amount, unit and calories are needed." };
  const m = (k: string) => Math.max(0, num(form.get(k)) ?? 0);
  const serving = num(form.get("servingQty"));
  const db = await getDb();
  await db
    .update(foods)
    .set({
      name,
      brand: str(form.get("brand"))?.slice(0, 80) ?? null,
      baseQty,
      unit,
      kcal,
      protein: m("protein"),
      carbs: m("carbs"),
      fat: m("fat"),
      servingQty: serving && serving > 0 ? serving : null,
    })
    .where(eq(foods.id, id));
  revalidatePath("/admin/foods");
  return { ok: "Saved. Foods already logged keep their old numbers." };
}

export async function adminDeleteFood(id: string): Promise<Result> {
  await requireAdmin();
  if (!UUID.test(id)) return { error: "Food not found." };
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(planItems).where(eq(planItems.foodId, id));
  if (n > 0) return { error: `This food is in ${n} meal plan item${n === 1 ? "" : "s"}. Remove it from those plans first.` };
  await db.delete(foods).where(eq(foods.id, id));
  revalidatePath("/admin/foods");
  return { ok: "Deleted." };
}
