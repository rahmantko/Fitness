import Link from "next/link";
import { and, asc, count, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { foods, users } from "@/db/schema";
import { Card, Empty, inputCls } from "@/components/ui";
import { FoodRow } from "@/components/admin-ui";

const PAGE = 50;

export default async function AdminFoods({ searchParams }: { searchParams: Promise<{ q?: string; source?: string; page?: string }> }) {
  const { q = "", source = "", page = "1" } = await searchParams;
  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const term = q.trim().slice(0, 80);
  const db = await getDb();
  const where: SQL[] = [];
  if (term) where.push(or(ilike(foods.name, `%${term}%`), ilike(foods.brand, `%${term}%`), eq(foods.barcode, term))!);
  if (source === "library") where.push(isNull(foods.createdBy), eq(foods.source, "library"));
  if (source === "openfoodfacts") where.push(eq(foods.source, "openfoodfacts"));
  if (source === "custom") where.push(eq(foods.source, "custom"));
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ f: foods, owner: users.name })
      .from(foods)
      .leftJoin(users, eq(foods.createdBy, users.id))
      .where(cond)
      .orderBy(asc(foods.name))
      .limit(PAGE)
      .offset((p - 1) * PAGE),
    db.select({ n: count() }).from(foods).where(cond),
  ]);
  const pages = Math.max(1, Math.ceil(n / PAGE));
  const link = (pg: number) => `?${new URLSearchParams({ q: term, source, page: String(pg) })}`;

  return (
    <>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={term} type="search" placeholder="Search food, brand or barcode" aria-label="Search foods" className={`${inputCls} min-w-[12rem] flex-1`} />
        <select name="source" defaultValue={source} aria-label="Source" className={`${inputCls} w-auto`}>
          <option value="">All foods</option>
          <option value="library">Starter library</option>
          <option value="openfoodfacts">From barcode / online</option>
          <option value="custom">Made by users</option>
        </select>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text">Search</button>
      </form>
      <Card title={`${n} food${n === 1 ? "" : "s"}`} action={<span className="text-xs text-muted">Tap a food to edit it</span>}>
        {rows.length === 0 ? (
          <Empty>No foods match.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ f, owner }) => (
              <FoodRow
                key={f.id}
                food={{
                  id: f.id, name: f.name, brand: f.brand, baseQty: f.baseQty, unit: f.unit, kcal: f.kcal, protein: f.protein,
                  carbs: f.carbs, fat: f.fat, servingQty: f.servingQty, barcode: f.barcode,
                  origin: f.source === "library" ? "Starter library" : f.source === "openfoodfacts" ? "Open Food Facts" : owner ? `Made by ${owner}` : "Custom",
                }}
              />
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            {p > 1 ? <Link href={link(p - 1)} className="text-accent">← Previous</Link> : <span />}
            <span className="text-muted">Page {p} of {pages}</span>
            {p < pages ? <Link href={link(p + 1)} className="text-accent">Next →</Link> : <span />}
          </div>
        )}
      </Card>
    </>
  );
}
