// Standard UFC division limits. Pounds are the source of truth; kilogram labels are rounded.
// Source: https://www.ufc.com/news/understanding-ufc-weight-classes-and-weigh-ins
export const UFC_WEIGHT_CLASS_SOURCE = "https://www.ufc.com/news/understanding-ufc-weight-classes-and-weigh-ins";
export const LB_TO_KG = 0.45359237;

const DIVISIONS = [
  { key: "straw", label: "Strawweight", limitLb: 115 },
  { key: "fly", label: "Flyweight", limitLb: 125 },
  { key: "bantam", label: "Bantamweight", limitLb: 135 },
  { key: "feather", label: "Featherweight", limitLb: 145 },
  { key: "light", label: "Lightweight", limitLb: 155 },
  { key: "welter", label: "Welterweight", limitLb: 170 },
  { key: "middle", label: "Middleweight", limitLb: 185 },
  { key: "light-heavy", label: "Light Heavyweight", limitLb: 205 },
  { key: "heavy", label: "Heavyweight", limitLb: 265 },
] as const;

export const WEIGHT_CLASSES = DIVISIONS.map((division, i) => ({
  ...division,
  fromLb: i === 0 ? 0 : DIVISIONS[i - 1].limitLb,
  from: (i === 0 ? 0 : DIVISIONS[i - 1].limitLb) * LB_TO_KG,
  to: division.limitLb * LB_TO_KG,
}));

export type WeightClass = (typeof WEIGHT_CLASSES)[number];
export type WeightClassKey = WeightClass["key"];
export const ABOVE_UFC_LIMIT = { key: "above", label: "Above UFC limit", from: 265 * LB_TO_KG, to: Infinity } as const;

/** The limit belongs to the lighter division. No one-pound non-title allowance is applied. */
export function weightClassOf(kg: number): WeightClass | typeof ABOVE_UFC_LIMIT {
  // Weights are Postgres REAL values. Compare at that precision so an exact lb limit
  // remains in its division after the kg value is saved and read back.
  const storedKg = Math.fround(kg);
  return WEIGHT_CLASSES.find((c) => storedKg > Math.fround(c.from) && storedKg <= Math.fround(c.to)) ?? ABOVE_UFC_LIMIT;
}

export const isWeightClassKey = (v: unknown): v is WeightClassKey => WEIGHT_CLASSES.some((c) => c.key === v);

/** Upper bounds are inclusive; displayed kg values are approximate conversions of the exact pound limits. */
export function classRange(c: WeightClass, unit: "kg" | "lb"): string {
  const f = (lb: number) => unit === "lb" ? String(lb) : String(Math.round(lb * LB_TO_KG * 10) / 10);
  return c.fromLb === 0 ? `≤${f(c.limitLb)} ${unit}` : `>${f(c.fromLb)}–${f(c.limitLb)} ${unit}`;
}
