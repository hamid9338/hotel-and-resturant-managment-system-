import "server-only";
import { prisma } from "@/lib/db";
import { round2, toNumber } from "@/lib/money";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function rangeForPeriod(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = now;
  if (period === "yesterday") {
    const from = startOfDay(new Date(now.getTime() - 86_400_000));
    return { from, to: startOfDay(now) };
  }
  if (period === "7d") return { from: new Date(now.getTime() - 7 * 86_400_000), to };
  if (period === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000), to };
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to };
  }
  // "today" and default
  return { from: startOfDay(now), to };
}

export async function getDashboardSummary(range: { from: Date; to: Date }) {
  const { from, to } = range;
  const createdInRange = { createdAt: { gte: from, lte: to } };

  const [
    hotelRevenueAgg,
    restaurantRevenueAgg,
    purchaseCostsAgg,
    totalBookings,
    totalOrders,
    roomStatsRaw,
    recentBookings,
    highRiskCount,
    pendingCheckins,
    pendingCheckouts,
    outstandingAgg,
    topItemsRaw,
  ] = await Promise.all([
    prisma.booking.aggregate({ _sum: { total: true }, where: { status: { not: "CANCELLED" }, ...createdInRange } }),
    prisma.restaurantOrder.aggregate({ _sum: { total: true }, where: { paymentStatus: "PAID", ...createdInRange } }),
    prisma.oCRBill.aggregate({
      _sum: { total: true },
      where: { billType: "PURCHASE", scannedAt: { gte: from, lte: to } },
    }),
    prisma.booking.count({ where: { status: { not: "CANCELLED" }, ...createdInRange } }),
    prisma.restaurantOrder.count({ where: createdInRange }),
    prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.findMany({
      include: { guest: true, room: { include: { roomType: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.auditLog.count({ where: { riskLevel: "HIGH", ...createdInRange } }),
    prisma.booking.count({ where: { status: "RESERVED", checkIn: { lte: to } } }),
    prisma.booking.count({ where: { status: "CHECKED_IN", checkOut: { lte: to } } }),
    prisma.booking.aggregate({
      _sum: { balanceDue: true },
      where: { status: { in: ["RESERVED", "CHECKED_IN"] }, balanceDue: { gt: 0 } },
    }),
    prisma.orderItem.groupBy({
      by: ["menuItemId", "nameSnapshot"],
      _sum: { qty: true },
      where: { order: { status: "BILLED", ...createdInRange } },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
  ]);

  const hotelRevenue = toNumber(hotelRevenueAgg._sum.total);
  const restaurantRevenue = toNumber(restaurantRevenueAgg._sum.total);
  const purchaseCosts = toNumber(purchaseCostsAgg._sum.total);

  const roomStats = Object.fromEntries(roomStatsRaw.map((r) => [r.status, r._count._all]));

  return {
    hotelRevenue,
    restaurantRevenue,
    totalRevenue: round2(hotelRevenue + restaurantRevenue),
    purchaseCosts,
    estimatedProfit: round2(hotelRevenue + restaurantRevenue - purchaseCosts),
    totalBookings,
    totalOrders,
    roomStats,
    pendingCheckins,
    pendingCheckouts,
    outstandingPayments: toNumber(outstandingAgg._sum.balanceDue),
    highRiskActions: highRiskCount,
    topMenuItems: topItemsRaw.map((t) => ({ name: t.nameSnapshot, qty: t._sum.qty ?? 0 })),
    recentBookings,
  };
}

export async function getDailyTrend(days: number) {
  const today = startOfDay(new Date());
  const results: { date: string; hotel: number; restaurant: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * 86_400_000);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const [hotelAgg, restaurantAgg] = await Promise.all([
      prisma.booking.aggregate({
        _sum: { total: true },
        where: { status: { not: "CANCELLED" }, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
      prisma.restaurantOrder.aggregate({
        _sum: { total: true },
        where: { paymentStatus: "PAID", createdAt: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

    results.push({
      date: dayStart.toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
      hotel: toNumber(hotelAgg._sum.total),
      restaurant: toNumber(restaurantAgg._sum.total),
    });
  }

  return results;
}
