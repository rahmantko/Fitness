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

/** Full-text product search. Open Food Facts sometimes rate-limits this; callers should handle errors. */
export async function searchProducts(query: string): Promise<OffFood[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "15",
    fields: FIELDS,
  });
  const res = await get(`/cgi/search.pl?${params}`, 10000);
  if (!res.ok) throw new Error(`Food database returned ${res.status}`);
  const body = (await res.json()) as { products?: OffProduct[] };
  return (body.products ?? []).map(toFood).filter((f): f is OffFood => !!f && f.kcal != null);
}
