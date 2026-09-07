import { describe, it, expect } from "vitest";
import {
  checkRevenueDrop,
  checkCashShiftVarianceStreak,
  checkLowStockVelocity,
  REVENUE_DROP_THRESHOLD_PCT,
  CASH_VARIANCE_STREAK_COUNT,
  STOCK_VELOCITY_DAYS_THRESHOLD,
} from "@/lib/services/anomalies";

describe("checkRevenueDrop", () => {
  it("does not trigger when yesterday matches the trailing average", () => {
    const result = checkRevenueDrop(1000, [1000, 1000, 1000, 1000, 1000, 1000, 1000]);
    expect(result.triggered).toBe(false);
  });
  it("triggers once the drop meets the threshold", () => {
    const trailing = [1000, 1000, 1000, 1000, 1000, 1000, 1000]; // average 1000
    const justUnder = checkRevenueDrop(1000 * (1 - REVENUE_DROP_THRESHOLD_PCT / 100 + 0.01), trailing);
    const justOver = checkRevenueDrop(1000 * (1 - REVENUE_DROP_THRESHOLD_PCT / 100 - 0.01), trailing);
    expect(justUnder.triggered).toBe(false);
    expect(justOver.triggered).toBe(true);
  });
  it("does not trigger, and does not divide by zero, when the trailing average is zero", () => {
    const result = checkRevenueDrop(0, [0, 0, 0]);
    expect(result.triggered).toBe(false);
    expect(Number.isFinite(result.dropPct)).toBe(true);
  });
  it("does not trigger on an empty history", () => {
    const result = checkRevenueDrop(500, []);
    expect(result.triggered).toBe(false);
  });
  it("does not trigger when revenue rises above the trailing average", () => {
    const result = checkRevenueDrop(2000, [1000, 1000, 1000]);
    expect(result.triggered).toBe(false);
  });
});

describe("checkCashShiftVarianceStreak", () => {
  it("does not trigger below the streak threshold", () => {
    const shifts = Array.from({ length: CASH_VARIANCE_STREAK_COUNT - 1 }, () => ({ variance: 50 }));
    expect(checkCashShiftVarianceStreak(shifts).triggered).toBe(false);
  });
  it("triggers once the streak reaches the threshold", () => {
    const shifts = Array.from({ length: CASH_VARIANCE_STREAK_COUNT }, () => ({ variance: -50 }));
    expect(checkCashShiftVarianceStreak(shifts).triggered).toBe(true);
  });
  it("stops counting at the first zero-variance shift, most-recent-first", () => {
    const shifts = [{ variance: 50 }, { variance: 0 }, { variance: 50 }, { variance: 50 }, { variance: 50 }];
    const result = checkCashShiftVarianceStreak(shifts);
    expect(result.streak).toBe(1);
    expect(result.triggered).toBe(false);
  });
  it("does not trigger on an empty history", () => {
    expect(checkCashShiftVarianceStreak([]).triggered).toBe(false);
  });
});

describe("checkLowStockVelocity", () => {
  it("does not trigger for an item already at or below its reorder level (that's low_stock's job)", () => {
    const result = checkLowStockVelocity({ quantityOnHand: 5, reorderLevel: 10 }, 20, 14);
    expect(result.triggered).toBe(false);
  });
  it("does not trigger, and does not divide by zero, when there's been no recent consumption", () => {
    const result = checkLowStockVelocity({ quantityOnHand: 50, reorderLevel: 10 }, 0, 14);
    expect(result.triggered).toBe(false);
    expect(result.daysUntilReorder).toBeNull();
  });
  it("does not trigger, and does not divide by zero, for a zero-length window", () => {
    const result = checkLowStockVelocity({ quantityOnHand: 50, reorderLevel: 10 }, 20, 0);
    expect(result.triggered).toBe(false);
  });
  it("triggers when consumption velocity will hit the reorder level within the threshold", () => {
    // 40 units above reorder, consuming 20 units / 14 days -> ~28 days out: not triggered.
    const farOut = checkLowStockVelocity({ quantityOnHand: 50, reorderLevel: 10 }, 20, 14);
    expect(farOut.triggered).toBe(false);

    // 3 units above reorder, consuming 21 units / 14 days = 1.5/day -> 2 days out: triggered.
    const soon = checkLowStockVelocity({ quantityOnHand: 13, reorderLevel: 10 }, 21, 14);
    expect(soon.triggered).toBe(true);
    expect(soon.daysUntilReorder).toBeLessThanOrEqual(STOCK_VELOCITY_DAYS_THRESHOLD);
  });
});
