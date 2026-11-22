import Link from "next/link";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { cardioPlan, planMeals, users, type DayType } from "@/db/schema";
import { getViewableClient, requireUser } from "@/lib/session";
import { getPlan } from "@/lib/nutrition";
import { sumMacros } from "@/lib/macros";
import { Card, Empty } from "@/components/ui";
import { MacroBars } from "@/components/macro-bars";
import { CardioPlanForm, CopyFromClient, PlanMealEditor, PlanToolbar } from "@/components/plan-ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const viewer = await requireUser();
  const isCoach = viewer.role === "coach";
  const dayType: DayType = type === "rest" ? "rest" : "training";
  const other: DayType = dayType === "training" ? "rest" : "training";

  const db = await getDb();
  const [plan, otherPlan, cardio] = await Promise.all([
    getPlan(id, dayType),
    getPlan(id, other),
    db.select().from(cardioPlan).where(eq(cardioPlan.clientId, id)),
  ]);
  // Other clients of this coach who have a plan to copy from.
  const client = isCoach ? await getViewableClient(viewer, id) : null;
  const others = isCoach
    ? (
        await db
          .selectDistinct({ id: users.id, name: users.name })
          .from(users)
          .innerJoin(planMeals, eq(planMeals.clientId, users.id))
          .where(and(eq(users.coachId, viewer.id), ne(users.id, id)))
          .orderBy(asc(users.name))
      )
    : [];
  const total = sumMacros(plan.map((m) => m.target));
  const cardioMap = Object.fromEntries(cardio.map((c) => [c.weekday, c.task]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Meal plan</h2>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
          {(["training", "rest"] as const).map((t) => (
            <Link
              key={t}
              href={`?type=${t}`}
              aria-current={dayType === t ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${dayType === t ? "bg-accent font-medium text-accent-text" : "text-muted hover:text-text"}`}
            >
              {t === "training" ? "Training day" : "Rest day"}
            </Link>
          ))}
        </div>
      </div>

      <Card title={`${dayType === "training" ? "Training" : "Rest"} day totals`}>
        {plan.length ? <MacroBars logged={total} target={null} /> : <Empty>{isCoach ? "Add meals below to build this plan." : "Your coach hasn't set up this plan yet."}</Empty>}
      </Card>

      {plan.map((m, i) => (
        <PlanMealEditor
          key={m.id}
          clientId={id}
          editable={isCoach}
          first={i === 0}
          last={i === plan.length - 1}
          meal={{
            id: m.id,
            name: m.name,
            notes: m.notes,
            target: m.target,
            items: m.items.map((it) => ({
              id: it.id,
              qty: it.qty,
              foodName: it.food.brand ? `${it.food.name} (${it.food.brand})` : it.food.name,
              unit: it.food.unit,
              macros: it.macros,
            })),
          }}
        />
      ))}

      {isCoach && (
        <Card>
          <PlanToolbar clientId={id} dayType={dayType} otherHasMeals={otherPlan.length > 0} />
        </Card>
      )}

      {isCoach && (
        <Card title="Copy a plan from another client">
          <CopyFromClient clientId={id} clientName={client?.name ?? "this client"} others={others} />
        </Card>
      )}

      <Card title="Weekly cardio & steps plan">
        {isCoach ? (
          <CardioPlanForm clientId={id} plan={cardioMap} />
        ) : cardio.length ? (
          <ul className="space-y-1 text-sm">
            {WEEKDAYS.map((d, i) => (
              <li key={d} className="flex gap-3">
                <span className="w-10 text-muted">{d}</span>
                <span>{cardioMap[i] ?? "Rest"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No cardio plan yet.</Empty>
        )}
      </Card>
    </>
  );
}
