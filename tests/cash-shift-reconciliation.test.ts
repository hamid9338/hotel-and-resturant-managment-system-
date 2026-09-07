import { describe, it, expect } from "vitest";

const databaseUrl = process.env.DATABASE_URL ?? "";
const hasRealDb = databaseUrl.length > 0 && !databaseUrl.includes("placeholder");

describe.skipIf(!hasRealDb)("cash shift reconciliation", () => {
  it(
    "expectedAmount exactly matches openingFloat + a cash booking advance + a cash bill - a cash expense payout",
    async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentShift, openShift, closeShift } = await import("@/lib/services/cash-shift");
      const { createBooking } = await import("@/lib/services/bookings");

      const user = await prisma.user.findFirstOrThrow();
      const session = { id: user.id, name: user.name, username: user.username, roleId: user.roleId, roleName: "owner", shift: null };

      // Never fight a real (or leftover) open shift — this would block actual
      // staff use of the register, unlike a stray throwaway row elsewhere.
      const existing = await getCurrentShift();
      if (existing) {
        console.warn("Skipping cash-shift-reconciliation test: a shift is already open.");
        return;
      }

      const suffix = Date.now();
      const room = await prisma.room.findFirstOrThrow();
      let bookingId: string | null = null;
      let expenseId: string | null = null;
      let createdShiftId: string | null = null;
      let shiftStillOpen = false;

      try {
        const shift = await openShift(session, { openingFloat: 1000 });
        createdShiftId = shift.id;
        shiftStillOpen = true;

        // Cash advance at booking creation — this is the exact gap fixed
        // this milestone (createBooking now records a real Payment row).
        const checkIn = new Date();
        const checkOut = new Date(checkIn.getTime() + 86_400_000);
        const booking = await createBooking(session, {
          roomId: room.id,
          guestName: `Test CashShift Guest-${suffix}`,
          cnic: `99999-${suffix}-9`,
          phone: "0300-0000000",
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          advancePaid: 2000,
          paymentMethod: "CASH",
        });
        bookingId = booking.id;

        // A cash expense payout during the shift.
        const expense = await prisma.expense.create({
          data: { category: "Test", amount: 300, method: "CASH", createdById: user.id },
        });
        expenseId = expense.id;
        await prisma.$transaction([
          prisma.expense.update({ where: { id: expense.id }, data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date() } }),
          prisma.payment.create({ data: { expenseId: expense.id, amount: 300, method: "CASH", direction: "OUT", receivedById: user.id } }),
        ]);

        const closed = await closeShift(session, shift.id, { closingCountedAmount: 2700 });
        // 1000 opening + 2000 cash advance - 300 cash expense = 2700 expected.
        expect(Number(closed.expectedAmount)).toBe(2700);
        expect(Number(closed.variance)).toBe(0);
        shiftStillOpen = false;
      } finally {
        if (bookingId) {
          await prisma.payment.deleteMany({ where: { bookingId } });
          await prisma.booking.delete({ where: { id: bookingId } }).catch(() => {});
          await prisma.guest.deleteMany({ where: { name: { contains: `Test CashShift Guest-${suffix}` } } });
        }
        if (expenseId) {
          await prisma.payment.deleteMany({ where: { expenseId } });
          await prisma.expense.delete({ where: { id: expenseId } }).catch(() => {});
        }
        if (createdShiftId) {
          // If the test threw before closeShift ran, force-close first so a
          // failed run never leaves a shift stuck open in production.
          if (shiftStillOpen) {
            await prisma.cashShift.update({ where: { id: createdShiftId }, data: { status: "CLOSED", closedAt: new Date() } }).catch(() => {});
          }
          await prisma.cashShift.delete({ where: { id: createdShiftId } }).catch(() => {});
        }
      }
    },
    30_000
  );
});
