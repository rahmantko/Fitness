/**
 * Demo data: one coach, two clients, ~12 weeks of logs, weekly check-ins with
 * placeholder photos, workouts and two blood tests.
 *   Coach:  coach@demo.test / password123  (invite code DEMO1234)
 *   Client: alex@demo.test  / password123
 */
import bcrypt from "bcryptjs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb, migrateDb } from "../src/db/client";
import * as s from "../src/db/schema";

const day = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
// Deterministic pseudo-random so reseeding gives the same charts.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (n: number) => (rand() - 0.5) * n;

async function main() {
  const db = await createDb();
  await migrateDb(db);

  const existing = await db.select().from(s.users).where(eq(s.users.email, "coach@demo.test"));
  if (existing.length) {
    console.log("Demo data already present.");
    process.exit(0);
  }

  const hash = await bcrypt.hash("password123", 10);
  const [coach] = await db
    .insert(s.users)
    .values({ email: "coach@demo.test", name: "Sam Rivera", passwordHash: hash, role: "coach", inviteCode: "DEMO1234" })
    .returning();
  const [alex] = await db
    .insert(s.users)
    .values({ email: "alex@demo.test", name: "Alex Morgan", passwordHash: hash, role: "client", coachId: coach.id })
    .returning();
  const [jo] = await db
    .insert(s.users)
    .values({ email: "jo@demo.test", name: "Jo Patel", passwordHash: hash, role: "client", coachId: coach.id })
    .returning();

  await db.insert(s.targets).values([
    { clientId: alex.id, calories: 2300, protein: 180, carbs: 230, fat: 70, steps: 10000, goalWeightKg: 80 },
    { clientId: jo.id, calories: 1900, protein: 140, carbs: 200, fat: 60, steps: 9000, goalWeightKg: 62 },
  ]);

  // ~12 weeks of daily logs for Alex, trending down from 88 kg.
  const DAYS = 84;
  const logs = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    if (rand() < 0.08) continue; // missed days
    const progress = (DAYS - i) / DAYS;
    logs.push({
      clientId: alex.id,
      date: day(i),
      weightKg: Math.round((88 - progress * 5.5 + jitter(0.9)) * 10) / 10,
      steps: Math.round(8500 + progress * 2500 + jitter(4000)),
      calories: Math.round(2300 + jitter(300)),
      protein: Math.round(175 + jitter(30)),
      carbs: Math.round(230 + jitter(50)),
      fat: Math.round(70 + jitter(16)),
    });
  }
  await db.insert(s.dailyLogs).values(logs);
  for (let i = 20; i >= 0; i--) {
    await db.insert(s.dailyLogs).values({ clientId: jo.id, date: day(i), weightKg: 66 - (20 - i) * 0.05, steps: Math.round(8000 + jitter(3000)) });
  }

  // Weekly check-ins with placeholder photos.
  const uploads = path.join(process.cwd(), "data", "uploads");
  const demo = path.join(process.cwd(), "scripts", "demo-photos");
  const notes = [
    "First week done. Hunger was high midweek.",
    "Sleep better this week, energy up.",
    "Missed one session (work travel) but hit steps.",
    "Feeling strong on presses.",
  ];
  for (let w = 11; w >= 0; w--) {
    const date = day(w * 7);
    const progress = (11 - w) / 11;
    const [c] = await db
      .insert(s.checkins)
      .values({
        clientId: alex.id,
        date,
        weightKg: Math.round((88 - progress * 5.3) * 10) / 10,
        bodyFatPct: Math.round((22 - progress * 3.4) * 10) / 10,
        waistCm: Math.round((94 - progress * 6) * 10) / 10,
        chestCm: Math.round((106 - progress * 2) * 10) / 10,
        hipsCm: Math.round((102 - progress * 3) * 10) / 10,
        armCm: Math.round((37 + progress * 0.4) * 10) / 10,
        thighCm: Math.round((60 - progress * 1.5) * 10) / 10,
        energy: 6 + Math.round(progress * 2),
        sleep: 6 + Math.round(rand() * 2),
        adherence: 7 + Math.round(rand() * 2),
        notes: notes[w % notes.length],
        coachFeedback: w === 0 ? null : "Good week. Keep protein up and aim for 10k steps on rest days too.",
      })
      .returning();
    if (w === 11 || w === 6 || w === 0) {
      const stage = w === 11 ? "a" : w === 6 ? "b" : "c";
      for (const pose of ["front", "side", "back"] as const) {
        const key = `${alex.id}/${randomUUID()}.png`;
        await mkdir(path.join(uploads, alex.id), { recursive: true });
        await copyFile(path.join(demo, `${pose}-${stage}.png`), path.join(uploads, key));
        await db.insert(s.photos).values({ checkinId: c.id, pose, fileKey: key });
      }
    }
  }
  await db.insert(s.checkins).values({ clientId: jo.id, date: day(2), weightKg: 65, energy: 7, sleep: 8, adherence: 9, notes: "Great week!" });

  // Workouts: Upper/Lower split, 3x a week, progressive overload.
  const plan = {
    Upper: [["Bench press", 70], ["Barbell row", 65], ["Overhead press", 42.5], ["Lat pulldown", 60]],
    Lower: [["Back squat", 100], ["Romanian deadlift", 90], ["Leg press", 160], ["Calf raise", 80]],
  } as const;
  for (let wk = 11; wk >= 0; wk--) {
    for (const [offset, name] of [[5, "Upper"], [3, "Lower"], [1, "Upper"]] as const) {
      const [wo] = await db
        .insert(s.workouts)
        .values({ clientId: alex.id, date: day(wk * 7 + offset), name: `${name} ${offset === 1 ? "B" : "A"}` })
        .returning();
      const sets = plan[name].flatMap(([ex, base]) =>
        [1, 2, 3].map((n) => ({
          workoutId: wo.id,
          exercise: ex,
          setNumber: n,
          reps: 8 - (n === 3 ? 1 : 0),
          weightKg: base + (11 - wk) * 1.25,
          rpe: 7 + n * 0.5,
        })),
      );
      await db.insert(s.workoutSets).values(sets);
    }
  }

  // Two blood tests.
  const panel = (scale: number) => [
    { name: "Total testosterone", value: 16.8 * scale, unit: "nmol/L", refLow: 8.6, refHigh: 29 },
    { name: "HbA1c", value: 38 / scale, unit: "mmol/mol", refLow: 20, refHigh: 41 },
    { name: "LDL", value: 3.4 / scale, unit: "mmol/L", refLow: 0, refHigh: 3 },
    { name: "HDL", value: 1.1 * scale, unit: "mmol/L", refLow: 1, refHigh: 2.2 },
    { name: "Vitamin D", value: 48 * scale * scale, unit: "nmol/L", refLow: 50, refHigh: 175 },
    { name: "Ferritin", value: 120, unit: "µg/L", refLow: 30, refHigh: 400 },
  ];
  for (const [ago, scale] of [[80, 1], [5, 1.12]] as const) {
    const [t] = await db.insert(s.bloodTests).values({ clientId: alex.id, date: day(ago), lab: "Demo Labs" }).returning();
    await db.insert(s.bloodMarkers).values(panel(scale).map((m) => ({ ...m, value: Math.round(m.value * 100) / 100, testId: t.id })));
  }

  // ---------- Meal plan, food log and cardio for Alex ----------
  const lib = await db.select().from(s.foods);
  const food = (name: string) => {
    const f = lib.find((x) => x.name === name);
    if (!f) throw new Error(`Missing food ${name}`);
    return f;
  };
  const scale = (f: s.Food, qty: number) => {
    const k = qty / f.baseQty;
    return { kcal: f.kcal * k, protein: f.protein * k, carbs: f.carbs * k, fat: f.fat * k };
  };
  const PLAN: Record<s.DayType, [string, string | null, [string, number][]][]> = {
    training: [
      ["Meal 1", null, [["Wheat biscuit cereal", 3], ["Whey protein isolate", 40], ["Peanut butter", 20], ["Blueberries, frozen", 100]]],
      ["Meal 2", null, [["Chicken breast, raw", 200], ["White rice, cooked", 250], ["Broccoli", 100]]],
      ["Pre-workout", "60–90 min before training", [["Bagel, plain", 1], ["Honey", 20], ["Greek yogurt 0% fat", 200]]],
      ["Post-workout", "Within an hour of training", [["Chocolate rice cereal", 80], ["Whey protein isolate", 40], ["Semi-skimmed milk", 200]]],
      ["Meal 5", null, [["Beef mince 5% fat, raw", 200], ["Potato, raw", 300], ["Mixed vegetables, frozen", 150]]],
    ],
    rest: [
      ["Meal 1", null, [["Egg", 3], ["Wholemeal bread", 2], ["Blueberries, frozen", 100]]],
      ["Meal 2", null, [["Chicken breast, raw", 200], ["White rice, cooked", 150], ["Broccoli", 150]]],
      ["Meal 3", null, [["Greek yogurt 0% fat", 250], ["Whey protein isolate", 30], ["Almonds", 20]]],
      ["Meal 4", null, [["Salmon fillet, raw", 180], ["Sweet potato, raw", 200], ["Spinach", 80]]],
    ],
  };
  const planIds: Record<s.DayType, { id: string; items: [string, number][] }[]> = { training: [], rest: [] };
  for (const dayType of ["training", "rest"] as const) {
    for (const [pos, [name, notes, items]] of PLAN[dayType].entries()) {
      const [pm] = await db.insert(s.planMeals).values({ clientId: alex.id, dayType, position: pos, name, notes }).returning();
      await db.insert(s.planItems).values(items.map(([f, qty]) => ({ planMealId: pm.id, foodId: food(f).id, qty })));
      planIds[dayType].push({ id: pm.id, items });
    }
  }
  const planTotal = (t: s.DayType) =>
    PLAN[t].flatMap(([, , its]) => its).reduce((a, [f, q]) => a + scale(food(f), q).kcal, 0);
  await db
    .update(s.targets)
    .set({ calories: Math.round(planTotal("training")) })
    .where(eq(s.targets.clientId, alex.id));

  // 14 days of food logs following the plan with small deviations; today only breakfast so far.
  for (let i = 13; i >= 0; i--) {
    const date = day(i);
    const weekday = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
    const dayType: s.DayType = [0, 1, 3, 4].includes(weekday) ? "training" : "rest";
    await db.insert(s.nutritionDays).values({ clientId: alex.id, date, dayType, completedAt: i === 0 ? null : new Date() });
    let total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    for (const [pos, pm] of planIds[dayType].entries()) {
      const [dm] = await db
        .insert(s.dayMeals)
        .values({
          clientId: alex.id,
          date,
          name: PLAN[dayType][pos][0],
          position: pos,
          planMealId: pm.id,
          completedAt: i === 0 && pos > 0 ? null : new Date(),
        })
        .returning();
      if (i === 0 && pos > 0) continue;
      const rows = pm.items.map(([fname, qty]) => {
        const f = food(fname);
        const q = f.unit === "g" || f.unit === "ml" ? Math.round(qty * (1 + jitter(0.15))) : qty;
        return { dayMealId: dm.id, foodId: f.id, name: f.name, qty: q, unit: f.unit, ...scale(f, q) };
      });
      await db.insert(s.mealItems).values(rows);
      for (const r of rows) total = { kcal: total.kcal + r.kcal, protein: total.protein + r.protein, carbs: total.carbs + r.carbs, fat: total.fat + r.fat };
    }
    const values = { calories: Math.round(total.kcal), protein: Math.round(total.protein), carbs: Math.round(total.carbs), fat: Math.round(total.fat) };
    await db
      .insert(s.dailyLogs)
      .values({ clientId: alex.id, date, ...values })
      .onConflictDoUpdate({ target: [s.dailyLogs.clientId, s.dailyLogs.date], set: values });
  }

  // Weekly cardio plan and two weeks of cardio logs.
  const CARDIO = ["30 min stair climber", "30 min stair climber", "30 min stair climber", "10k steps", "30 min stair climber", "30 min stair climber", "10k steps"];
  await db.insert(s.cardioPlan).values(CARDIO.map((task, weekday) => ({ clientId: alex.id, weekday, task })));
  for (let i = 13; i >= 1; i--) {
    const date = day(i);
    const weekday = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
    if (CARDIO[weekday].includes("stair") && rand() > 0.15) {
      await db.insert(s.cardioLogs).values({
        clientId: alex.id,
        date,
        activity: "Stair climber",
        durationMin: 30,
        avgHr: Math.round(135 + jitter(16)),
        kcal: Math.round(300 + jitter(60)),
      });
    }
  }

  console.log("Seeded demo data.\n  Coach:  coach@demo.test / password123\n  Client: alex@demo.test / password123");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
