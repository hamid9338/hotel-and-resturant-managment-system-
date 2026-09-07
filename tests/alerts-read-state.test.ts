import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("alerts read state", () => {
  it("counts only alerts created after lastAlertsViewedAt as unread, and mark-viewed zeroes it", async () => {
    const { prisma } = await import("@/lib/db");
    const { getUnreadAlertSummary, markAlertsViewed } = await import("@/lib/services/alerts");

    const user = await prisma.user.findFirstOrThrow();
    const originalLastViewed = user.lastAlertsViewedAt;
    let alertId: string | null = null;

    try {
      await markAlertsViewed(user.id);
      const baseline = await getUnreadAlertSummary(user.id);
      expect(baseline.count).toBe(0);

      const alert = await prisma.alert.create({
        data: { type: "test_alert", message: "Test unread alert", severity: "LOW" },
      });
      alertId = alert.id;

      const afterNewAlert = await getUnreadAlertSummary(user.id);
      expect(afterNewAlert.count).toBeGreaterThanOrEqual(1);
      expect(afterNewAlert.recent.some((a) => a.id === alert.id)).toBe(true);

      await markAlertsViewed(user.id);
      const afterViewed = await getUnreadAlertSummary(user.id);
      expect(afterViewed.count).toBe(0);
    } finally {
      if (alertId) await prisma.alert.delete({ where: { id: alertId } }).catch(() => {});
      await prisma.user.update({ where: { id: user.id }, data: { lastAlertsViewedAt: originalLastViewed } });
    }
  }, 30_000);
});
