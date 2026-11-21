import "server-only";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import {
  dailyLogs,
  dayMeals,
  foods,
  mealItems,
  nutritionDays,
  planItems,
  planMeals,
  type DayType,
} from "@/db/schema";
import { scaleFood, sumMacros, type Macros } from "./macros";

const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

/** Meal plan for one day type, with each planned food and its macros. */
export async function getPlan(clientId: string, dayType: DayType) {
  const db = await getDb();
  const meals = await db
    .select()
    .from(planMeals)
    .where(and(eq(planMeals.clientId, clientId), eq(planMeals.dayType, dayType)))
    .orderBy(asc(planMeals.position));
  const items = meals.length
    ? await db
        .select({ item: planItems, food: foods })
        .from(planItems)
        .innerJoin(foods, eq(planItems.foodId, foods.id))
        .where(inArray(planItems.planMealId, meals.map((m) => m.id)))
    : [];
  return meals.map((m) => {
    const its = items
      .filter((i) => i.item.planMealId === m.id)
      .map((i) => ({ ...i.item, food: i.food, macros: scaleFood(i.food, i.item.qty) }));
    return { ...m, items: its, target: sumMacros(its.map((i) => i.macros)) };
  });
}

export type PlanMeal = Awaited<ReturnType<typeof getPlan>>[number];

/** The plan's day type for a date if nothing is logged yet: training days by default. */
async function defaultDayType(clientId: string): Promise<DayType> {
  const db = await getDb();
  const [last] = await db
    .select({ dayType: nutritionDays.dayType })
    .from(nutritionDays)
    .where(eq(nutritionDays.clientId, clientId))
    .orderBy(desc(nutritionDays.date))
    .limit(1);
  return last?.dayType ?? "training";
}

/**
 * Creates the day's record and its meals from the plan the first time a client opens it.
 * Coaches never trigger this, so their views don't create empty days.
 */
export async function ensureDay(clientId: string, date: string) {
  const db = await getDb();
  const [day] = await db
    .select()
    .from(nutritionDays)
    .where(and(eq(nutritionDays.clientId, clientId), eq(nutritionDays.date, date)));
  if (day) return day;
  const dayType = await defaultDayType(clientId);
  const [created] = await db
    .insert(nutritionDays)
    .values({ clientId, date, dayType })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    const [again] = await db
      .select()
      .from(nutritionDays)
      .where(and(eq(nutritionDays.clientId, clientId), eq(nutritionDays.date, date)));
    return again;
  }
  await syncMealsToPlan(clientId, date, dayType);
  return created;
}

/** Adds the plan's meals for this day type; removes empty meals that came from another plan. */
export async function syncMealsToPlan(clientId: string, date: string, dayType: DayType) {
  const db = await getDb();
  const plan = await getPlan(clientId, dayType);
  const existing = await db
    .select()
    .from(dayMeals)
    .where(and(eq(dayMeals.clientId, clientId), eq(dayMeals.date, date)));
  const counts = existing.length
    ? await db
        .select({ dayMealId: mealItems.dayMealId })
        .from(mealItems)
        .where(inArray(mealItems.dayMealId, existing.map((m) => m.id)))
    : [];
  const hasItems = new Set(counts.map((c) => c.dayMealId));
  const planIds = new Set(plan.map((p) => p.id));

  // Empty meals that came from another plan are dropped; the client's own meals stay.
  const stale = existing.filter((m) => m.planMealId && !planIds.has(m.planMealId) && !hasItems.has(m.id));
  if (stale.length) await db.delete(dayMeals).where(inArray(dayMeals.id, stale.map((m) => m.id)));
  const kept = existing.filter((m) => !stale.includes(m));

  // Meals with food logged keep their food. If the new plan has a meal with the same
  // name, they take its place (and targets); otherwise they become the client's own meal.
  const linked = new Set(kept.filter((m) => m.planMealId && planIds.has(m.planMealId)).map((m) => m.planMealId));
  for (const m of kept) {
    if (m.planMealId && planIds.has(m.planMealId)) continue;
    if (!m.planMealId && !hasItems.has(m.id)) continue;
    const match = plan.find((p) => !linked.has(p.id) && p.name.trim().toLowerCase() === m.name.trim().toLowerCase());
    if (match) linked.add(match.id);
    if (match || m.planMealId) {
      await db
        .update(dayMeals)
        .set({ planMealId: match?.id ?? null, position: match?.position ?? m.position })
        .where(eq(dayMeals.id, m.id));
    }
  }

  const toAdd =
    plan.length > 0
      ? plan.filter((p) => !linked.has(p.id)).map((p) => ({ name: p.name, position: p.position, planMealId: p.id }))
      : kept.length === 0
        ? DEFAULT_MEALS.map((name, i) => ({ name, position: i, planMealId: null }))
        : [];
  if (toAdd.length) await db.insert(dayMeals).values(toAdd.map((m) => ({ ...m, clientId, date })));
}

/** Everything the nutrition page needs for one day. */
export async function getNutritionDay(clientId: string, date: string) {
  const db = await getDb();
  const [day] = await db
    .select()
    .from(nutritionDays)
    .where(and(eq(nutritionDays.clientId, clientId), eq(nutritionDays.date, date)));
  const dayType: DayType = day?.dayType ?? (await defaultDayType(clientId));
  const plan = await getPlan(clientId, dayType);
  const meals = await db
    .select()
    .from(dayMeals)
    .where(and(eq(dayMeals.clientId, clientId), eq(dayMeals.date, date)))
    .orderBy(asc(dayMeals.position), asc(dayMeals.name));
  const items = meals.length
    ? await db
        .select()
        .from(mealItems)
        .where(inArray(mealItems.dayMealId, meals.map((m) => m.id)))
        .orderBy(asc(mealItems.createdAt))
    : [];
  const withItems = meals.map((m) => {
    const its = items.filter((i) => i.dayMealId === m.id);
    const planMeal = plan.find((p) => p.id === m.planMealId) ?? null;
    return { ...m, items: its, logged: sumMacros(its), planMeal };
  });
  const logged = sumMacros(withItems.map((m) => m.logged));
  const planTarget: Macros | null = plan.length ? sumMacros(plan.map((p) => p.target)) : null;
  return { day: day ?? null, dayType, meals: withItems, logged, planTarget };
}

/** Writes the day's food totals into the daily log so charts and the coach dashboard see them. */
export async function recomputeDailyTotals(clientId: string, date: string) {
  const db = await getDb();
  const meals = await db
    .select({ id: dayMeals.id })
    .from(dayMeals)
    .where(and(eq(dayMeals.clientId, clientId), eq(dayMeals.date, date)));
  const items = meals.length
    ? await db.select().from(mealItems).where(inArray(mealItems.dayMealId, meals.map((m) => m.id)))
    : [];
  const t = sumMacros(items);
  const values = items.length
    ? {
        calories: Math.round(t.kcal),
        protein: Math.round(t.protein),
        carbs: Math.round(t.carbs),
        fat: Math.round(t.fat),
      }
    : { calories: null, protein: null, carbs: null, fat: null };
  await db
    .insert(dailyLogs)
    .values({ clientId, date, ...values })
    .onConflictDoUpdate({ target: [dailyLogs.clientId, dailyLogs.date], set: values });
}

/** Most recent earlier day that has any food logged. */
export async function previousLoggedDate(clientId: string, date: string) {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ date: dayMeals.date })
    .from(dayMeals)
    .innerJoin(mealItems, eq(mealItems.dayMealId, dayMeals.id))
    .where(and(eq(dayMeals.clientId, clientId), lt(dayMeals.date, date)))
    .orderBy(desc(dayMeals.date))
    .limit(1);
  return rows[0]?.date ?? null;
}
