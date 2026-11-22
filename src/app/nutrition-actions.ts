"use server";

import { revalidatePath } from "next/cache";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, max } from "drizzle-orm";
import { getDb } from "@/db";
import {
  cardioLogs,
  cardioPlan,
  dayMeals,
  foods,
  mealItems,
  nutritionDays,
  planItems,
  planMeals,
  type DayType,
  type Food,
} from "@/db/schema";
import { getViewableClient, requireUser } from "@/lib/session";
import { scaleFood } from "@/lib/macros";
import { ensureDay, previousLoggedDate, recomputeDailyTotals, syncMealsToPlan } from "@/lib/nutrition";
import { int, isIsoDate, num, str, today } from "@/lib/format";
import { fetchByBarcode, searchProducts, type OffFood } from "@/lib/openfoodfacts";
import type { FormState } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

async function requireClient() {
  const user = await requireUser();
  if (user.role !== "client") throw new Error("Only clients can log food.");
  return user;
}

async function requireCoachOf(clientId: string) {
  const user = await requireUser();
  if (user.role !== "coach" || !isUuid(clientId) || !(await getViewableClient(user, clientId))) {
    throw new Error("Not allowed.");
  }
  return user;
}

/** The meal, if it belongs to the signed-in client. */
async function ownMeal(dayMealId: string) {
  const user = await requireClient();
  if (!isUuid(dayMealId)) throw new Error("Meal not found.");
  const db = await getDb();
  const [meal] = await db
    .select()
    .from(dayMeals)
    .where(and(eq(dayMeals.id, dayMealId), eq(dayMeals.clientId, user.id)));
  if (!meal) throw new Error("Meal not found.");
  return { user, meal, db };
}

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}`, "layout");
}

// ---------- Food library ----------

/** Search foods visible to the user: the shared library, their own and (for clients) their coach's. */
export async function searchFoods(query: string, clientId?: string): Promise<Food[]> {
  const user = await requireUser();
  const db = await getDb();
  const owners = [user.id];
  if (user.role === "client" && user.coachId) owners.push(user.coachId);
  if (user.role === "coach" && isUuid(clientId) && (await getViewableClient(user, clientId))) owners.push(clientId);
  const visible = or(isNull(foods.createdBy), inArray(foods.createdBy, owners));
  const q = query.trim().slice(0, 60);

  if (!q) {
    // Recently logged foods first, for one-tap re-adding.
    const subjectId = user.role === "client" ? user.id : isUuid(clientId) ? clientId : null;
    if (subjectId) {
      const recent = await db
        .select({ foodId: mealItems.foodId, last: max(mealItems.createdAt) })
        .from(mealItems)
        .innerJoin(dayMeals, eq(mealItems.dayMealId, dayMeals.id))
        .where(eq(dayMeals.clientId, subjectId))
        .groupBy(mealItems.foodId)
        .orderBy(desc(max(mealItems.createdAt)))
        .limit(12);
      const ids = recent.map((r) => r.foodId).filter((x): x is string => !!x);
      if (ids.length) {
        const rows = await db.select().from(foods).where(and(inArray(foods.id, ids), visible));
        return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is Food => !!r);
      }
    }
    return db.select().from(foods).where(visible).orderBy(asc(foods.name)).limit(12);
  }
  const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  return db
    .select()
    .from(foods)
    .where(and(visible, or(ilike(foods.name, like), ilike(foods.brand, like), eq(foods.barcode, q))))
    .orderBy(asc(foods.name))
    .limit(25);
}

export type CreateFoodState = { error?: string; ok?: string; food?: Food } | undefined;

export async function createFood(_: CreateFoodState, form: FormData): Promise<CreateFoodState> {
  const user = await requireUser();
  const name = str(form.get("name"));
  const baseQty = num(form.get("baseQty"));
  const unit = str(form.get("unit"));
  const kcal = num(form.get("kcal"));
  const protein = num(form.get("protein")) ?? 0;
  const carbs = num(form.get("carbs")) ?? 0;
  const fat = num(form.get("fat")) ?? 0;
  if (!name || !baseQty || baseQty <= 0 || !unit) return { error: "Enter a name, amount and unit." };
  if (kcal == null) return { error: "Enter the calories." };
  const db = await getDb();
  // A food made for an unknown barcode keeps that barcode so the next scan finds it.
  let barcode = String(form.get("barcode") ?? "").replace(/\D/g, "") || null;
  if (barcode) {
    const [taken] = await db.select({ id: foods.id }).from(foods).where(eq(foods.barcode, barcode));
    if (taken) barcode = null;
  }
  const [food] = await db
    .insert(foods)
    .values({ name: name.slice(0, 120), brand: str(form.get("brand")), baseQty, unit: unit.slice(0, 20), kcal, protein, carbs, fat, createdBy: user.id, barcode })
    .returning();
  return { ok: `Created ${food.name}.`, food };
}

// ---------- Food database (Open Food Facts) ----------

export type BarcodeResult =
  | { food: Food }
  | { notFound: true; barcode: string }
  | { noNutrition: OffFood }
  | { error: string };

/**
 * Finds a food by barcode: first in our own library (anything scanned before),
 * then in Open Food Facts, saving the product to the shared library.
 */
export async function lookupBarcode(raw: string): Promise<BarcodeResult> {
  const user = await requireUser();
  const barcode = raw.replace(/\D/g, "");
  if (barcode.length < 6 || barcode.length > 14) return { error: "That doesn't look like a barcode." };
  const db = await getDb();
  const [known] = await db.select().from(foods).where(eq(foods.barcode, barcode));
  // Shared foods, your own, and your coach's (for clients) are usable; someone else's custom food is not.
  if (known && (known.createdBy == null || known.createdBy === user.id || known.createdBy === user.coachId)) {
    return { food: known };
  }
  if (known) return { notFound: true, barcode };

  let product: OffFood | null;
  try {
    product = await fetchByBarcode(barcode);
  } catch {
    return { error: "Couldn't reach the food database. Check your connection and try again." };
  }
  if (!product) return { notFound: true, barcode };
  if (product.kcal == null) return { noNutrition: product };
  return { food: await saveOffFood(product) };
}

async function saveOffFood(p: OffFood): Promise<Food> {
  const db = await getDb();
  const [created] = await db
    .insert(foods)
    .values({
      name: p.name,
      brand: p.brand,
      baseQty: 100,
      unit: p.unit,
      servingQty: p.servingQty,
      kcal: p.kcal ?? 0,
      protein: p.protein ?? 0,
      carbs: p.carbs ?? 0,
      fat: p.fat ?? 0,
      barcode: p.barcode,
      source: "openfoodfacts",
    })
    .onConflictDoNothing({ target: foods.barcode })
    .returning();
  if (created) return created;
  const [existing] = await db.select().from(foods).where(eq(foods.barcode, p.barcode));
  return existing;
}

/** Searches Open Food Facts by name. Results are only saved once picked. */
export async function searchOnline(query: string): Promise<{ results: OffFood[] } | { error: string }> {
  await requireUser();
  const q = query.trim().slice(0, 80);
  if (q.length < 3) return { error: "Type at least 3 letters." };
  try {
    return { results: await searchProducts(q) };
  } catch {
    return { error: "Online search is busy right now. Try again in a minute, or scan the barcode instead." };
  }
}

/** Saves a product picked from online search results (looked up again by barcode for fresh data). */
export async function importOnlineFood(barcode: string): Promise<BarcodeResult> {
  return lookupBarcode(barcode);
}

// ---------- Client: logging food ----------

export async function addMealItem(dayMealId: string, foodId: string, qty: number) {
  const { user, meal, db } = await ownMeal(dayMealId);
  if (!isUuid(foodId) || !(qty > 0) || qty > 100000) throw new Error("Invalid amount.");
  const visible = await searchFoodsById(foodId, user.id, user.coachId);
  if (!visible) throw new Error("Food not found.");
  await db.insert(mealItems).values({
    dayMealId: meal.id,
    foodId: visible.id,
    name: visible.brand ? `${visible.name} (${visible.brand})` : visible.name,
    qty,
    unit: visible.unit,
    ...scaleFood(visible, qty),
  });
  await recomputeDailyTotals(user.id, meal.date);
  refresh(user.id);
}

async function searchFoodsById(foodId: string, userId: string, coachId: string | null) {
  const db = await getDb();
  const owners = coachId ? [userId, coachId] : [userId];
  const [f] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, foodId), or(isNull(foods.createdBy), inArray(foods.createdBy, owners))));
  return f ?? null;
}

export async function updateMealItemQty(itemId: string, qty: number) {
  const user = await requireClient();
  if (!isUuid(itemId) || !(qty > 0) || qty > 100000) throw new Error("Invalid amount.");
  const db = await getDb();
  const [row] = await db
    .select({ item: mealItems, meal: dayMeals })
    .from(mealItems)
    .innerJoin(dayMeals, eq(mealItems.dayMealId, dayMeals.id))
    .where(and(eq(mealItems.id, itemId), eq(dayMeals.clientId, user.id)));
  if (!row) throw new Error("Item not found.");
  const k = qty / row.item.qty;
  await db
    .update(mealItems)
    .set({
      qty,
      kcal: row.item.kcal * k,
      protein: row.item.protein * k,
      carbs: row.item.carbs * k,
      fat: row.item.fat * k,
    })
    .where(eq(mealItems.id, itemId));
  await recomputeDailyTotals(user.id, row.meal.date);
  refresh(user.id);
}

export async function removeMealItem(itemId: string) {
  const user = await requireClient();
  if (!isUuid(itemId)) return;
  const db = await getDb();
  const [row] = await db
    .select({ id: mealItems.id, date: dayMeals.date })
    .from(mealItems)
    .innerJoin(dayMeals, eq(mealItems.dayMealId, dayMeals.id))
    .where(and(eq(mealItems.id, itemId), eq(dayMeals.clientId, user.id)));
  if (!row) return;
  await db.delete(mealItems).where(eq(mealItems.id, itemId));
  await recomputeDailyTotals(user.id, row.date);
  refresh(user.id);
}

/** Copies the planned foods for this meal into the log (skipping foods already there). */
async function addPlannedFoods(db: Db, meal: { id: string; planMealId: string | null }) {
  if (!meal.planMealId) return;
  const planned = await db
    .select({ item: planItems, food: foods })
    .from(planItems)
    .innerJoin(foods, eq(planItems.foodId, foods.id))
    .where(eq(planItems.planMealId, meal.planMealId));
  const existing = await db.select({ foodId: mealItems.foodId }).from(mealItems).where(eq(mealItems.dayMealId, meal.id));
  const have = new Set(existing.map((e) => e.foodId));
  const rows = planned
    .filter((p) => !have.has(p.food.id))
    .map((p) => ({
      dayMealId: meal.id,
      foodId: p.food.id,
      name: p.food.brand ? `${p.food.name} (${p.food.brand})` : p.food.name,
      qty: p.item.qty,
      unit: p.food.unit,
      ...scaleFood(p.food, p.item.qty),
    }));
  if (rows.length) await db.insert(mealItems).values(rows);
}

export async function fillMealFromPlan(dayMealId: string) {
  const { user, meal, db } = await ownMeal(dayMealId);
  await addPlannedFoods(db, meal);
  await recomputeDailyTotals(user.id, meal.date);
  refresh(user.id);
}

/** One tap: "I ate this meal as planned" logs the planned foods and ticks the meal. */
export async function eatMealAsPlanned(dayMealId: string) {
  const { user, meal, db } = await ownMeal(dayMealId);
  await addPlannedFoods(db, meal);
  await db.update(dayMeals).set({ completedAt: new Date() }).where(eq(dayMeals.id, meal.id));
  await recomputeDailyTotals(user.id, meal.date);
  refresh(user.id);
}

/** Logs something extra without looking up a food, e.g. "Sauce, 120 kcal". */
export async function quickAddItem(
  dayMealId: string,
  input: { name: string; kcal: number; protein?: number | null; carbs?: number | null; fat?: number | null },
): Promise<{ error?: string }> {
  const { user, meal, db } = await ownMeal(dayMealId);
  const name = input.name.trim().slice(0, 80) || "Extra";
  const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 20000;
  if (!ok(input.kcal)) return { error: "Enter the calories." };
  const m = (n: number | null | undefined) => (ok(n) ? (n as number) : 0);
  await db.insert(mealItems).values({
    dayMealId: meal.id,
    foodId: null,
    name,
    qty: 1,
    unit: "serving",
    kcal: input.kcal,
    protein: m(input.protein),
    carbs: m(input.carbs),
    fat: m(input.fat),
  });
  await recomputeDailyTotals(user.id, meal.date);
  refresh(user.id);
  return {};
}

export async function toggleMealComplete(dayMealId: string) {
  const { user, meal, db } = await ownMeal(dayMealId);
  await db
    .update(dayMeals)
    .set({ completedAt: meal.completedAt ? null : new Date() })
    .where(eq(dayMeals.id, meal.id));
  refresh(user.id);
}

export async function addMeal(date: string, name: string) {
  const user = await requireClient();
  if (!isIsoDate(date)) return;
  const clean = name.trim().slice(0, 60) || "Extra meal";
  await ensureDay(user.id, date);
  const db = await getDb();
  const [last] = await db
    .select({ position: max(dayMeals.position) })
    .from(dayMeals)
    .where(and(eq(dayMeals.clientId, user.id), eq(dayMeals.date, date)));
  await db.insert(dayMeals).values({ clientId: user.id, date, name: clean, position: (last?.position ?? -1) + 1 });
  refresh(user.id);
}

export async function removeMeal(dayMealId: string) {
  const { user, meal, db } = await ownMeal(dayMealId);
  await db.delete(dayMeals).where(eq(dayMeals.id, meal.id));
  await recomputeDailyTotals(user.id, meal.date);
  refresh(user.id);
}

export async function setDayType(date: string, dayType: DayType) {
  const user = await requireClient();
  if (!isIsoDate(date) || (dayType !== "training" && dayType !== "rest")) return;
  await ensureDay(user.id, date);
  const db = await getDb();
  await db
    .update(nutritionDays)
    .set({ dayType })
    .where(and(eq(nutritionDays.clientId, user.id), eq(nutritionDays.date, date)));
  await syncMealsToPlan(user.id, date, dayType);
  refresh(user.id);
}

export async function toggleDayComplete(date: string) {
  const user = await requireClient();
  if (!isIsoDate(date)) return;
  const day = await ensureDay(user.id, date);
  const db = await getDb();
  await db
    .update(nutritionDays)
    .set({ completedAt: day.completedAt ? null : new Date() })
    .where(and(eq(nutritionDays.clientId, user.id), eq(nutritionDays.date, date)));
  refresh(user.id);
}

/** Copies every food from the last logged day into meals with the same name. */
export async function copyPreviousDay(date: string): Promise<FormState> {
  const user = await requireClient();
  if (!isIsoDate(date)) return { error: "Invalid date." };
  const from = await previousLoggedDate(user.id, date);
  if (!from) return { error: "No earlier day with food logged." };
  await ensureDay(user.id, date);
  const db = await getDb();
  const src = await db
    .select({ meal: dayMeals, item: mealItems })
    .from(mealItems)
    .innerJoin(dayMeals, eq(mealItems.dayMealId, dayMeals.id))
    .where(and(eq(dayMeals.clientId, user.id), eq(dayMeals.date, from)));
  const target = await db
    .select()
    .from(dayMeals)
    .where(and(eq(dayMeals.clientId, user.id), eq(dayMeals.date, date)));
  let nextPos = Math.max(-1, ...target.map((t) => t.position)) + 1;
  for (const name of [...new Set(src.map((s) => s.meal.name))]) {
    let dest = target.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!dest) {
      [dest] = await db.insert(dayMeals).values({ clientId: user.id, date, name, position: nextPos++ }).returning();
      target.push(dest);
    }
    const rows = src.filter((s) => s.meal.name === name);
    await db.insert(mealItems).values(
      rows.map(({ item }) => ({
        dayMealId: dest!.id,
        foodId: item.foodId,
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        kcal: item.kcal,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      })),
    );
  }
  await recomputeDailyTotals(user.id, date);
  refresh(user.id);
  return { ok: `Copied ${src.length} foods from ${from}.` };
}

// ---------- Coach: meal plan ----------

async function ownPlanMeal(planMealId: string) {
  if (!isUuid(planMealId)) throw new Error("Meal not found.");
  const db = await getDb();
  const [pm] = await db.select().from(planMeals).where(eq(planMeals.id, planMealId));
  if (!pm) throw new Error("Meal not found.");
  await requireCoachOf(pm.clientId);
  return { pm, db };
}

export async function addPlanMeal(clientId: string, dayType: DayType, name: string) {
  await requireCoachOf(clientId);
  if (dayType !== "training" && dayType !== "rest") return;
  const db = await getDb();
  const [last] = await db
    .select({ position: max(planMeals.position) })
    .from(planMeals)
    .where(and(eq(planMeals.clientId, clientId), eq(planMeals.dayType, dayType)));
  await db.insert(planMeals).values({
    clientId,
    dayType,
    name: name.trim().slice(0, 60) || "Meal",
    position: (last?.position ?? -1) + 1,
  });
  refresh(clientId);
}

export async function updatePlanMeal(planMealId: string, name: string, notes: string) {
  const { pm, db } = await ownPlanMeal(planMealId);
  await db
    .update(planMeals)
    .set({ name: name.trim().slice(0, 60) || pm.name, notes: notes.trim().slice(0, 500) || null })
    .where(eq(planMeals.id, pm.id));
  await db.update(dayMeals).set({ name: name.trim().slice(0, 60) || pm.name }).where(eq(dayMeals.planMealId, pm.id));
  refresh(pm.clientId);
}

export async function movePlanMeal(planMealId: string, dir: -1 | 1) {
  const { pm, db } = await ownPlanMeal(planMealId);
  const list = await db
    .select()
    .from(planMeals)
    .where(and(eq(planMeals.clientId, pm.clientId), eq(planMeals.dayType, pm.dayType)))
    .orderBy(asc(planMeals.position));
  const i = list.findIndex((m) => m.id === pm.id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [pos, m] of list.entries()) {
    await db.update(planMeals).set({ position: pos }).where(eq(planMeals.id, m.id));
  }
  refresh(pm.clientId);
}

export async function removePlanMeal(planMealId: string) {
  const { pm, db } = await ownPlanMeal(planMealId);
  await db.delete(planMeals).where(eq(planMeals.id, pm.id));
  refresh(pm.clientId);
}

export async function addPlanItem(planMealId: string, foodId: string, qty: number) {
  const { pm, db } = await ownPlanMeal(planMealId);
  if (!isUuid(foodId) || !(qty > 0) || qty > 100000) throw new Error("Invalid amount.");
  const coach = await requireUser();
  const [f] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, foodId), or(isNull(foods.createdBy), inArray(foods.createdBy, [coach.id, pm.clientId]))));
  if (!f) throw new Error("Food not found.");
  await db.insert(planItems).values({ planMealId: pm.id, foodId, qty });
  refresh(pm.clientId);
}

export async function updatePlanItemQty(itemId: string, qty: number) {
  if (!isUuid(itemId) || !(qty > 0) || qty > 100000) return;
  const db = await getDb();
  const [it] = await db.select().from(planItems).where(eq(planItems.id, itemId));
  if (!it) return;
  const { pm } = await ownPlanMeal(it.planMealId);
  await db.update(planItems).set({ qty }).where(eq(planItems.id, itemId));
  refresh(pm.clientId);
}

export async function removePlanItem(itemId: string) {
  if (!isUuid(itemId)) return;
  const db = await getDb();
  const [it] = await db.select().from(planItems).where(eq(planItems.id, itemId));
  if (!it) return;
  const { pm } = await ownPlanMeal(it.planMealId);
  await db.delete(planItems).where(eq(planItems.id, itemId));
  refresh(pm.clientId);
}

/** Replaces one day type's plan with a copy of the other. */
type Db = Awaited<ReturnType<typeof getDb>>;

/** Replaces one of a client's day plans with a copy of another plan (same or another client). */
async function replacePlan(db: Db, toClient: string, toType: DayType, fromClient: string, fromType: DayType) {
  const old = await db
    .select({ id: planMeals.id })
    .from(planMeals)
    .where(and(eq(planMeals.clientId, toClient), eq(planMeals.dayType, toType)));
  if (old.length) {
    // Empty meals made from the old plan are removed; meals with food logged are kept and relinked later.
    const oldIds = old.map((m) => m.id);
    const linked = await db.select({ id: dayMeals.id }).from(dayMeals).where(inArray(dayMeals.planMealId, oldIds));
    if (linked.length) {
      const withFood = await db
        .select({ id: mealItems.dayMealId })
        .from(mealItems)
        .where(inArray(mealItems.dayMealId, linked.map((m) => m.id)));
      const keep = new Set(withFood.map((r) => r.id));
      const empty = linked.filter((m) => !keep.has(m.id)).map((m) => m.id);
      if (empty.length) await db.delete(dayMeals).where(inArray(dayMeals.id, empty));
    }
    await db.delete(planMeals).where(inArray(planMeals.id, oldIds));
  }
  const src = await db
    .select()
    .from(planMeals)
    .where(and(eq(planMeals.clientId, fromClient), eq(planMeals.dayType, fromType)))
    .orderBy(asc(planMeals.position));
  for (const m of src) {
    const [copy] = await db
      .insert(planMeals)
      .values({ clientId: toClient, dayType: toType, name: m.name, position: m.position, notes: m.notes })
      .returning();
    const its = await db.select().from(planItems).where(eq(planItems.planMealId, m.id));
    if (its.length) await db.insert(planItems).values(its.map((i) => ({ planMealId: copy.id, foodId: i.foodId, qty: i.qty })));
  }
}

/** Brings today's and future days in line with a changed plan. */
async function resyncUpcomingDays(db: Db, clientId: string) {
  const days = await db
    .select()
    .from(nutritionDays)
    .where(and(eq(nutritionDays.clientId, clientId), gte(nutritionDays.date, today())));
  for (const d of days) await syncMealsToPlan(clientId, d.date, d.dayType);
}

export async function copyPlan(clientId: string, from: DayType) {
  await requireCoachOf(clientId);
  const to: DayType = from === "training" ? "rest" : "training";
  const db = await getDb();
  await replacePlan(db, clientId, to, clientId, from);
  await resyncUpcomingDays(db, clientId);
  refresh(clientId);
}

/** Copies another client's meal plans (and optionally cardio plan) onto this client, replacing theirs. */
export async function copyPlanFromClient(
  toClient: string,
  fromClient: string,
  opts: { training: boolean; rest: boolean; cardio: boolean },
): Promise<{ ok?: string; error?: string }> {
  await requireCoachOf(toClient);
  await requireCoachOf(fromClient);
  if (toClient === fromClient) return { error: "Pick a different client." };
  if (!opts.training && !opts.rest && !opts.cardio) return { error: "Tick at least one thing to copy." };
  const db = await getDb();
  if (opts.training) await replacePlan(db, toClient, "training", fromClient, "training");
  if (opts.rest) await replacePlan(db, toClient, "rest", fromClient, "rest");
  if (opts.cardio) {
    const src = await db.select().from(cardioPlan).where(eq(cardioPlan.clientId, fromClient));
    await db.delete(cardioPlan).where(eq(cardioPlan.clientId, toClient));
    if (src.length) await db.insert(cardioPlan).values(src.map((c) => ({ clientId: toClient, weekday: c.weekday, task: c.task })));
  }
  await resyncUpcomingDays(db, toClient);
  refresh(toClient);
  return { ok: "Copied. Adjust anything you need below." };
}

// ---------- Cardio ----------

export async function saveCardioPlan(_: FormState, form: FormData): Promise<FormState> {
  const clientId = String(form.get("clientId"));
  await requireCoachOf(clientId);
  const db = await getDb();
  for (let d = 0; d < 7; d++) {
    const task = str(form.get(`day${d}`));
    if (task) {
      await db
        .insert(cardioPlan)
        .values({ clientId, weekday: d, task: task.slice(0, 200) })
        .onConflictDoUpdate({ target: [cardioPlan.clientId, cardioPlan.weekday], set: { task: task.slice(0, 200) } });
    } else {
      await db.delete(cardioPlan).where(and(eq(cardioPlan.clientId, clientId), eq(cardioPlan.weekday, d)));
    }
  }
  refresh(clientId);
  return { ok: "Cardio plan saved." };
}

export async function logCardio(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireClient();
  const activity = str(form.get("activity"));
  const date = String(form.get("date") ?? "");
  if (!activity) return { error: "What did you do? e.g. Stair climber" };
  if (!isIsoDate(date)) return { error: "Pick a date." };
  const durationMin = int(form.get("durationMin"));
  if (durationMin == null && num(form.get("distanceKm")) == null) return { error: "Enter a duration or distance." };
  const db = await getDb();
  await db.insert(cardioLogs).values({
    clientId: user.id,
    date,
    activity: activity.slice(0, 80),
    durationMin,
    distanceKm: num(form.get("distanceKm")),
    avgHr: int(form.get("avgHr")),
    kcal: int(form.get("kcal")),
    notes: str(form.get("notes")),
  });
  refresh(user.id);
  return { ok: `Logged ${activity}.` };
}

export async function removeCardio(id: string) {
  const user = await requireClient();
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.delete(cardioLogs).where(and(eq(cardioLogs.id, id), eq(cardioLogs.clientId, user.id)));
  refresh(user.id);
}
