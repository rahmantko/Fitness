import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getTargets } from "@/lib/queries";
import { ensureDay, getNutritionDay } from "@/lib/nutrition";
import { fmtDate, isIsoDate, today } from "@/lib/format";
import { Card, Empty } from "@/components/ui";
import { MacroBars } from "@/components/macro-bars";
import { DayActions, DayTypeToggle, MealCard, type MealView } from "@/components/nutrition-ui";
import type { Macros } from "@/lib/macros";

function shift(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: q } = await searchParams;
  const viewer = await requireUser();
  const isClient = viewer.role === "client";
  const date = isIsoDate(q) ? q : today();

  if (isClient) await ensureDay(id, date);
  const [{ day, dayType, meals, logged, planTarget }, t] = await Promise.all([getNutritionDay(id, date), getTargets(id)]);
  const fallback: Macros | null =
    t?.calories != null
      ? { kcal: t.calories, protein: t.protein ?? 0, carbs: t.carbs ?? 0, fat: t.fat ?? 0 }
      : null;
  const target = planTarget ?? fallback;

  const views: MealView[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    completed: !!m.completedAt,
    fromPlan: !!m.planMealId,
    planHasFoods: !!m.planMeal?.items.length,
    planNotes: m.planMeal?.notes ?? null,
    planned: (m.planMeal?.items ?? []).map((it) => ({
      name: it.food.brand ? `${it.food.name} (${it.food.brand})` : it.food.name,
      qty: it.qty,
      unit: it.food.unit,
      kcal: it.macros.kcal,
    })),
    items: m.items,
    logged: m.logged,
    target: m.planMeal?.items.length ? m.planMeal.target : null,
  }));
  const label = date === today() ? "Today" : date === shift(today(), -1) ? "Yesterday" : fmtDate(date);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?date=${shift(date, -1)}`} aria-label="Previous day" className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">
            ‹
          </Link>
          <span className="min-w-[7.5rem] text-center font-semibold">{label}</span>
          <Link href={`?date=${shift(date, 1)}`} aria-label="Next day" className="rounded-lg border border-border bg-surface px-3 py-1.5 hover:bg-surface-2">
            ›
          </Link>
          {date !== today() && (
            <Link href="?" className="ml-1 text-sm text-accent">
              Today
            </Link>
          )}
        </div>
        <DayTypeToggle date={date} dayType={dayType} editable={isClient} />
      </div>

      <Card
        title={day?.completedAt ? "Day completed ✓" : "Daily totals"}
        action={
          <span className="text-xs text-muted">
            {planTarget ? `Targets from your ${dayType} day plan` : fallback ? "Targets set by coach" : "No targets set"}
          </span>
        }
      >
        <MacroBars logged={logged} target={target} />
      </Card>

      {views.length === 0 && !isClient && <Empty>Nothing logged on this day.</Empty>}
      {views.map((m) => (
        <MealCard key={m.id} meal={m} editable={isClient} />
      ))}

      {isClient && (
        <Card>
          <DayActions date={date} completed={!!day?.completedAt} />
        </Card>
      )}
    </>
  );
}
