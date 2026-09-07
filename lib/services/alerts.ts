import "server-only";
import { prisma } from "@/lib/db";

export async function getUnreadAlertSummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastAlertsViewedAt: true } });
  const since = user?.lastAlertsViewedAt ?? new Date(0);

  const [count, recentRows] = await Promise.all([
    prisma.alert.count({ where: { resolved: false, createdAt: { gt: since } } }),
    prisma.alert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, message: true, severity: true, createdAt: true },
    }),
  ]);

  // Serialized to a string here (rather than left as a Date) so the shape is
  // identical whether this reaches the client via the SSR layout prop or via
  // the JSON API route's fetch — one type, not "Date over RSC, string over JSON".
  const recent = recentRows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

  return { count, recent };
}

export async function markAlertsViewed(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { lastAlertsViewedAt: new Date() } });
}
