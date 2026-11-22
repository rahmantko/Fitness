import "server-only";

// Open Food Facts: free, open product database (https://world.openfoodfacts.org).
// No API key. They ask apps to send a descriptive User-Agent and to keep
// full-text searches to a few per minute, so barcode lookups are the main path.
const BASE = "https://world.openfoodfacts.org";
const UA = "Checkpoint-Coaching/0.1 (+https://world.openfoodfacts.org/data)";
const FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "quantity",
  "product_quantity_unit",
  "serving_size",
  "serving_quantity",
  "nutriments",
].join(",");

export type OffFood = {
  barcode: string;
  name: string;
  brand: string | null;
  unit: "g" | "ml";
  servingQty: number | null;
  // per 100 g / ml; null when the product page has no nutrition data
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  product_quantity_unit?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

function n(v: unknown): number | null {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
}

function toFood(p: OffProduct): OffFood | null {
  const barcode = p.code?.trim();
  const name = (p.product_name_en || p.product_name || p.generic_name || "").trim();
  if (!barcode || !name) return null;
  const nu = p.nutriments ?? {};
  let kcal = n(nu["energy-kcal_100g"]);
  if (kcal == null && n(nu["energy-kj_100g"]) != null) kcal = Math.round((n(nu["energy-kj_100g"])! / 4.184) * 10) / 10;
  const liquid = p.product_quantity_unit === "ml" || /\b\d+(\.\d+)?\s*(ml|cl|l)\b/i.test(p.quantity ?? "");
  const serving = n(p.serving_quantity);
  return {
    barcode,
    name: name.slice(0, 120),
    brand: p.brands?.split(",")[0]?.trim().slice(0, 80) || null,
    unit: liquid ? "ml" : "g",
    servingQty: serving && serving > 0 && serving < 5000 ? serving : null,
    kcal,
    protein: n(nu["proteins_100g"]),
    carbs: n(nu["carbohydrates_100g"]),
    fat: n(nu["fat_100g"]),
  };
}

async function get(path: string, timeoutMs: number) {
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  return res;
}

/** Looks up one product by barcode. Returns null when the barcode isn't in the database. */
export async function fetchByBarcode(barcode: string): Promise<OffFood | null> {
  const res = await get(`/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, 8000);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Food database returned ${res.status}`);
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status === 0 || !body.product) return null;
  return toFood({ ...body.product, code: body.product.code ?? barcode });
}

type SearchHit = Omit<OffProduct, "brands" | "product_name"> & {
  brands?: string | string[];
  product_name?: string | Record<string, string>;
};

function normaliseHit(h: SearchHit): OffProduct {
  const brands = Array.isArray(h.brands) ? h.brands.join(",") : h.brands;
  const pn = h.product_name;
  const name = typeof pn === "string" ? pn : pn ? (pn.en ?? pn.main ?? Object.values(pn)[0]) : undefined;
  return { ...h, brands, product_name: name };
}

// Search results are cached briefly because every user of the app shares one
// server IP, and Open Food Facts limits how many searches each IP can make.
const cache = new Map<string, { at: number; results: OffFood[] }>();
const CACHE_MS = 60 * 60 * 1000;

function rank(query: string, foods: OffFood[]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (f: OffFood) => {
    const text = `${f.name} ${f.brand ?? ""}`.toLowerCase();
    return words.filter((w) => text.includes(w)).length;
  };
  const seen = new Set<string>();
  return foods
    .filter((f) => f.kcal != null && !seen.has(f.barcode) && seen.add(f.barcode))
    .map((f, i) => ({ f, s: score(f), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.f);
}

/** Search-a-licious, Open Food Facts' current search service. */
async function searchService(query: string): Promise<OffFood[]> {
  const params = new URLSearchParams({ q: query, page_size: "25", langs: "en", fields: FIELDS });
  const res = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Food search returned ${res.status}`);
  const body = (await res.json()) as { hits?: SearchHit[] };
  return (body.hits ?? []).map((h) => toFood(normaliseHit(h))).filter((f): f is OffFood => !!f);
}

/** The older search on the main site; slower and often busy, kept as a fallback. */
async function searchLegacy(query: string): Promise<OffFood[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: FIELDS,
  });
  const res = await get(`/cgi/search.pl?${params}`, 10000);
  if (!res.ok) throw new Error(`Food database returned ${res.status}`);
  const body = (await res.json()) as { products?: OffProduct[] };
  return (body.products ?? []).map(toFood).filter((f): f is OffFood => !!f);
}

/** Full-text product search (brands and packaged foods). Throws if every source fails. */
export async function searchProducts(query: string): Promise<OffFood[]> {
  const key = query.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;
  let found: OffFood[] | null = null;
  let lastError: unknown;
  for (const source of [searchService, searchLegacy]) {
    try {
      found = await source(query);
      if (found.length) break;
    } catch (err) {
      lastError = err;
    }
  }
  if (found == null) throw lastError ?? new Error("Food search failed");
  const results = rank(query, found).slice(0, 20);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return results;
}
