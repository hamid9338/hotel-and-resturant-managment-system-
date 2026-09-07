import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { recordAudit, recordAlert } from "@/lib/services/audit";
import { round2, toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type { openCashShiftSchema, closeCashShiftSchema } from "@/lib/validation/cash-shift";

type OpenCashShiftInput = z.infer<typeof openCashShiftSchema>;
type CloseCashShiftInput = z.infer<typeof closeCashShiftSchema>;

// A variance beyond this is flagged the same way a large discount or a
// refund is — not blocked, just surfaced for review.
const VARIANCE_ALERT_THRESHOLD = 500;

const shiftInclude = {
  openedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
} as const;

/**
 * expectedAmount = openingFloat + Σ(CASH, IN, in window) - Σ(CASH, OUT, in
 * window). Correct only because createBooking's advance payment and
 * approveExpense's payout both create real Payment rows — see the comments
 * at those call sites.
 */
async function computeExpectedAmount(openingFloat: number, from: Date, to: Date) {
  const [inAgg, outAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { method: "CASH", direction: "IN", createdAt: { gte: from, lte: to } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { method: "CASH", direction: "OUT", createdAt: { gte: from, lte: to } },
    }),
  ]);
  return round2(openingFloat + toNumber(inAgg._sum.amount) - toNumber(outAgg._sum.amount));
}

export async function getCurrentShift() {
  const shift = await prisma.cashShift.findFirst({ where: { status: "OPEN" }, include: shiftInclude });
  if (!shift) return null;
  const livePreview = await computeExpectedAmount(toNumber(shift.openingFloat), shift.openedAt, new Date());
  return { ...shift, livePreview };
}

export async function listCashShifts() {
  return prisma.cashShift.findMany({
    where: { status: "CLOSED" },
    include: shiftInclude,
    orderBy: { closedAt: "desc" },
    take: 50,
  });
}

export async function openShift(session: SessionUser, input: OpenCashShiftInput) {
  // The DB-level partial unique index (CashShift_one_open_idx) is the real
  // guarantee against two staff opening a shift at once; this check just
  // gives a friendlier error for the common (non-race) case.
  const existing = await prisma.cashShift.findFirst({ where: { status: "OPEN" } });
  if (existing) throw new AppError("SHIFT_ALREADY_OPEN", "A cash shift is already open.", 409);

  const shift = await prisma.cashShift.create({
    data: { openedById: session.id, openingFloat: input.openingFloat },
    include: shiftInclude,
  });

  await recordAudit({
    session,
    action: `Cash shift opened — float ${input.openingFloat}`,
    module: "Finance",
    entityType: "CashShift",
    entityId: shift.id,
  });

  return shift;
}

export async function closeShift(session: SessionUser, shiftId: string, input: CloseCashShiftInput) {
  const shift = await prisma.cashShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AppError("SHIFT_NOT_FOUND", "Cash shift not found.", 404);
  if (shift.status !== "OPEN") throw new AppError("SHIFT_ALREADY_CLOSED", "This shift is already closed.", 409);

  const closedAt = new Date();
  // Frozen at close time, never live-recomputed — a refund processed later
  // shouldn't retroactively rewrite an already-counted drawer's history.
  const expectedAmount = await computeExpectedAmount(toNumber(shift.openingFloat), shift.openedAt, closedAt);
  const variance = round2(input.closingCountedAmount - expectedAmount);

  const updated = await prisma.cashShift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closedById: session.id,
      closedAt,
      closingCountedAmount: input.closingCountedAmount,
      expectedAmount,
      variance,
      notes: input.notes,
    },
    include: shiftInclude,
  });

  const isAnomalous = Math.abs(variance) >= VARIANCE_ALERT_THRESHOLD;

  await recordAudit({
    session,
    action: `Cash shift closed — expected ${expectedAmount}, counted ${input.closingCountedAmount}, variance ${variance}`,
    module: "Finance",
    entityType: "CashShift",
    entityId: shift.id,
    riskLevel: isAnomalous ? "MEDIUM" : "NONE",
    details: input.notes,
  });

  if (isAnomalous) {
    await recordAlert({
      type: "cash_variance",
      message: `Cash shift variance of ${variance} (${session.name})`,
      detail: `Expected ${expectedAmount}, counted ${input.closingCountedAmount}`,
      severity: "MEDIUM",
      userId: session.id,
      entityId: shift.id,
    });
  }

  return updated;
}
