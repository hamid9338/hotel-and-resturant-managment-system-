import "server-only";
import { prisma } from "@/lib/db";
import { syncDedupedAlert } from "@/lib/services/audit";
import { toNumber } from "@/lib/money";

const THROTTLE_MS = 30 * 60 * 1000;
const STOCK_VELOCITY_WINDOW_DAYS = 14;

export const REVENUE_DROP_THRESHOLD_PCT = 30;
export const CASH_VARIANCE_STREAK_COUNT = 3;
export const STOCK_VELOCITY_DAYS_THRESHOLD = 2;

/**
 * Compares *yesterday's completed* revenue against the trailing 7-day
 * average — never "today" against a trailing average, since today's
 * revenue is always partial until the day ends and would false-positive
 * every single morning.
 */
export function checkRevenueDrop(yesterdayTotal: number, trailingDailyTotals: number[]) {
  const validTotals = trailingDailyTotals.filter((n) => Number.isFinite(n));
  if (validTotals.length === 0) return { triggered: false, dropPct: 0 };
  const average = validTotals.reduce((a, b) => a + b, 0) / validTotals.length;
  if (average <= 0) return { triggered: false, dropPct: 0 };
  const dropPct = ((average - yesterdayTotal) / average) * 100;
  return { triggered: dropPct >= REVENUE_DROP_THRESHOLD_PCT, dropPct: Math.round(dropPct) };
}

export function checkCashShiftVarianceStreak(recentShiftsMostRecentFirst: { variance: number }[]) {
  let streak = 0;
  for (const shift of recentShiftsMostRecentFirst) {
    if (shift.variance !== 0) streak++;
    else break;
  }
  return { triggered: streak >= CASH_VARIANCE_STREAK_COUNT, streak };
}

/**
 * Distinct from the existing low_stock alert (lib/services/inventory.ts) —
 * this fires *before* an item crosses its reorder level, when consumption
 * velocity says it will soon. An item already at/below reorder level is
 * low_stock's job, not this one's, so it's explicitly excluded here.
 */
export function checkLowStockVelocity(
  item: { quantityOnHand: number; reorderLevel: number },
  recentConsumption: number,
  windowDays: number
) {
  if (item.quantityOnHand <= item.reorderLevel) return { triggered: false, daysUntilReorder: null as number | null };
  if (windowDays <= 0 || recentConsumption <= 0) return { triggered: false, daysUntilReorder: null };
  const dailyRate = recentConsumption / windowDays;
  const daysUntilReorder = Math.round(((item.quantityOnHand - item.reorderLevel) / dailyRate) * 10) / 10;
  return { triggered: daysUntilReorder <= STOCK_VELOCITY_DAYS_THRESHOLD, daysUntilReorder };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function dayRevenueTotal(dayStart: Date) {
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [hotel, restaurant] = await Promise.all([
    prisma.booking.aggregate({
      _sum: { total: true },
      where: { status: { not: "CANCELLED" }, createdAt: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.restaurantOrder.aggregate({
      _sum: { total: true },
      where: { paymentStatus: "PAID", createdAt: { gte: dayStart, lt: dayEnd } },
    }),
  ]);
  return toNumber(hotel._sum.total) + toNumber(restaurant._sum.total);
}

/**
 * Opportunistic, not scheduled — called from the dashboard-summary route
 * rather than a cron job (no scheduled-job infra exists in this app).
 * Throttled via SystemSetting.lastAnomalyCheckAt so most calls are a single
 * cheap read; the throttle timestamp is claimed before doing any real work
 * so two near-simultaneous requests don't both pay the full cost.
 */
export async function runAnomalyChecksIfDue(): Promise<void> {
  const settings = await prisma.systemSetting.findUnique({ where: { id: 1 }, select: { lastAnomalyCheckAt: true } });
  if (settings?.lastAnomalyCheckAt && Date.now() - settings.lastAnomalyCheckAt.getTime() < THROTTLE_MS) return;
  await prisma.systemSetting.update({ where: { id: 1 }, data: { lastAnomalyCheckAt: new Date() } });

  const today0 = startOfDay(new Date());
  const yesterdayStart = new Date(today0.getTime() - 86_400_000);
  const [yesterdayTotal, ...trailingTotals] = await Promise.all([
    dayRevenueTotal(yesterdayStart),
    ...Array.from({ length: 7 }, (_, i) => dayRevenueTotal(new Date(yesterdayStart.getTime() - (i + 1) * 86_400_000))),
  ]);
  const revenueCheck = checkRevenueDrop(yesterdayTotal, trailingTotals);
  await syncDedupedAlert({
    type: "revenue_drop",
    entityId: "daily_revenue",
    isActive: revenueCheck.triggered,
    message: `Yesterday's revenue was ${revenueCheck.dropPct}% below the trailing 7-day average`,
    severity: "MEDIUM",
  });

  const recentShifts = await prisma.cashShift.findMany({
    where: { status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 5,
    select: { variance: true },
  });
  const varianceCheck = checkCashShiftVarianceStreak(recentShifts.map((s) => ({ variance: toNumber(s.variance) })));
  await syncDedupedAlert({
    type: "cash_variance_streak",
    entityId: "cash_shifts",
    isActive: varianceCheck.triggered,
    message: `${varianceCheck.streak} consecutive cash shifts closed with a variance`,
    severity: "HIGH",
  });

  const windowStart = new Date(Date.now() - STOCK_VELOCITY_WINDOW_DAYS * 86_400_000);
  const [items, consumedRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { active: true },
      select: { id: true, name: true, quantityOnHand: true, reorderLevel: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["inventoryItemId"],
      _sum: { quantityDelta: true },
      where: { source: "RECIPE_DEDUCTION", createdAt: { gte: windowStart } },
    }),
  ]);
  const consumedByItem = new Map(consumedRows.map((r) => [r.inventoryItemId, Math.abs(Math.min(0, toNumber(r._sum.quantityDelta)))]));

  for (const item of items) {
    const velocityCheck = checkLowStockVelocity(
      { quantityOnHand: toNumber(item.quantityOnHand), reorderLevel: toNumber(item.reorderLevel) },
      consumedByItem.get(item.id) ?? 0,
      STOCK_VELOCITY_WINDOW_DAYS
    );
    await syncDedupedAlert({
      type: "stock_velocity",
      entityId: item.id,
      isActive: velocityCheck.triggered,
      message: `${item.name} is on pace to hit its reorder level in ~${velocityCheck.daysUntilReorder} day(s)`,
      severity: "MEDIUM",
    });
  }
}
