import { isNull, sql } from "drizzle-orm";
import { foods } from "./schema";
import type { Db } from "./client";

// Starter library of generic foods with typical values. Coaches and clients add
// their own (branded) foods on top. [name, baseQty, unit, kcal, protein, carbs, fat]
export const FOOD_LIBRARY: [string, number, string, number, number, number, number][] = [
  ["Wheat biscuit cereal", 1, "biscuit", 68, 2.2, 13, 0.4],
  ["Rolled oats", 100, "g", 375, 11, 60, 8],
  ["Granola", 100, "g", 450, 10, 64, 17],
  ["Chocolate rice cereal", 100, "g", 385, 5, 85, 1.5],
  ["Whey protein isolate", 100, "g", 370, 88, 4, 1],
  ["Whey protein concentrate", 100, "g", 400, 75, 8, 6],
  ["Peanut butter", 100, "g", 600, 25, 15, 50],
  ["Almonds", 100, "g", 579, 21, 22, 50],
  ["Blueberries, frozen", 100, "g", 57, 0.7, 14.5, 0.3],
  ["Banana", 1, "medium", 105, 1.3, 27, 0.4],
  ["Apple", 1, "medium", 95, 0.5, 25, 0.3],
  ["Egg", 1, "large", 72, 6.3, 0.4, 4.8],
  ["Egg whites, liquid", 100, "g", 52, 11, 0.7, 0.2],
  ["Chicken breast, raw", 100, "g", 120, 22.5, 0, 2.6],
  ["Turkey breast, raw", 100, "g", 105, 23, 0, 1],
  ["Beef mince 5% fat, raw", 100, "g", 125, 21, 0, 5],
  ["Salmon fillet, raw", 100, "g", 208, 20, 0, 13],
  ["Tuna in spring water, drained", 100, "g", 110, 25, 0, 1],
  ["White rice, cooked", 100, "g", 130, 2.7, 28, 0.3],
  ["Basmati rice, dry", 100, "g", 350, 8, 77, 1],
  ["Pasta, dry", 100, "g", 355, 12.5, 71, 1.5],
  ["Potato, raw", 100, "g", 77, 2, 17, 0.1],
  ["Sweet potato, raw", 100, "g", 86, 1.6, 20, 0.1],
  ["Wholemeal bread", 1, "slice", 95, 4, 16, 1.2],
  ["Bagel, plain", 1, "bagel", 250, 10, 48, 1.5],
  ["Tortilla wrap", 1, "wrap", 180, 5, 30, 4],
  ["Rice cake", 1, "cake", 35, 0.7, 7.3, 0.3],
  ["Honey", 100, "g", 304, 0.3, 82, 0],
  ["Greek yogurt 0% fat", 100, "g", 57, 10, 3.6, 0.2],
  ["Cottage cheese", 100, "g", 98, 11, 3.4, 4.3],
  ["Semi-skimmed milk", 100, "ml", 50, 3.6, 4.8, 1.8],
  ["Cheddar cheese", 100, "g", 410, 25, 0.1, 34],
  ["Olive oil", 100, "ml", 820, 0, 0, 91],
  ["Avocado", 100, "g", 160, 2, 8.5, 14.7],
  ["Mixed vegetables, frozen", 100, "g", 60, 3, 10, 0.5],
  ["Broccoli", 100, "g", 34, 2.8, 7, 0.4],
  ["Spinach", 100, "g", 23, 2.9, 3.6, 0.4],
  ["Protein bar", 1, "bar", 220, 20, 22, 7],
];

/** Adds the starter library once (when no shared foods exist yet). */
export async function seedFoodLibrary(db: Db) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(foods).where(isNull(foods.createdBy));
  if (n > 0) return;
  await db.insert(foods).values(
    FOOD_LIBRARY.map(([name, baseQty, unit, kcal, protein, carbs, fat]) => ({ name, baseQty, unit, kcal, protein, carbs, fat, source: "library" })),
  );
}
