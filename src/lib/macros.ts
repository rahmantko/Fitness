// Shared (client + server) macro helpers.
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function scaleFood(
  f: { baseQty: number; kcal: number; protein: number; carbs: number; fat: number },
  qty: number,
): Macros {
  const k = f.baseQty > 0 ? qty / f.baseQty : 0;
  return { kcal: f.kcal * k, protein: f.protein * k, carbs: f.carbs * k, fat: f.fat * k };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }),
    { ...ZERO },
  );
}

/** "1" / "1.5" / "250" — one decimal at most, no trailing zero. */
export function fmtMacro(n: number) {
  return (Math.round(n * 10) / 10).toLocaleString("en-GB", { maximumFractionDigits: 1 });
}
