/** Prisma Decimal fields deserialize to Decimal.js-like objects, not plain numbers. */
type Decimalish = { toNumber(): number };

export function toNumber(value: Decimalish | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
