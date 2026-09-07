import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("anomaly checks", () => {
  it("throttles runAnomalyChecksIfDue — a second call inside the window is a no-op", async () => {
    const { prisma } = await import("@/lib/db");
    const { runAnomalyChecksIfDue } = await import("@/lib/services/anomalies");

    const original = await prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 }, select: { lastAnomalyCheckAt: true } });

    try {
      await prisma.systemSetting.update({ where: { id: 1 }, data: { lastAnomalyCheckAt: null } });
      await runAnomalyChecksIfDue();
      const afterFirst = await prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 }, select: { lastAnomalyCheckAt: true } });
      expect(afterFirst.lastAnomalyCheckAt).not.toBeNull();

      await runAnomalyChecksIfDue();
      const afterSecond = await prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 }, select: { lastAnomalyCheckAt: true } });
      // Unchanged — the second call short-circuited on the throttle instead of re-claiming the window.
      expect(afterSecond.lastAnomalyCheckAt!.getTime()).toBe(afterFirst.lastAnomalyCheckAt!.getTime());
    } finally {
      await prisma.systemSetting.update({ where: { id: 1 }, data: { lastAnomalyCheckAt: original.lastAnomalyCheckAt } });
    }
  }, 30_000);

  // The three real checks (revenue drop, cash-variance streak, stock
  // velocity) all raise through this one shared primitive — exercising it
  // directly is more reliable than engineering a real trailing-average
  // revenue drop against a shared, already-populated production dataset.
  it("syncDedupedAlert dedupes a persisting condition and auto-resolves once it clears", async () => {
    const { prisma } = await import("@/lib/db");
    const { syncDedupedAlert } = await import("@/lib/services/audit");

    const type = "test_anomaly_dedup";
    const entityId = `test-${Date.now()}`;

    try {
      await syncDedupedAlert({ type, entityId, isActive: true, message: "Condition A" });
      await syncDedupedAlert({ type, entityId, isActive: true, message: "Condition A still true" });

      const activeAlerts = await prisma.alert.findMany({ where: { type, entityId, resolved: false } });
      expect(activeAlerts.length).toBe(1);

      await syncDedupedAlert({ type, entityId, isActive: false, message: "Condition A cleared" });

      const stillUnresolved = await prisma.alert.findMany({ where: { type, entityId, resolved: false } });
      expect(stillUnresolved.length).toBe(0);
      const resolved = await prisma.alert.findMany({ where: { type, entityId, resolved: true } });
      expect(resolved.length).toBe(1);
    } finally {
      await prisma.alert.deleteMany({ where: { type, entityId } });
    }
  }, 30_000);
});
