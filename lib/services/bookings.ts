import "server-only";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import { assertRoomAvailable } from "@/lib/services/availability";
import { getSettings } from "@/lib/services/settings";
import { recordAudit, recordAlert } from "@/lib/services/audit";
import { round2, toNumber } from "@/lib/money";
import type { SessionUser } from "@/lib/auth/session";
import type { createBookingSchema, checkoutSchema, discountSchema } from "@/lib/validation/hotel";

type CreateBookingInput = z.infer<typeof createBookingSchema>;
type CheckoutInput = z.infer<typeof checkoutSchema>;
type DiscountInput = z.infer<typeof discountSchema>;

const bookingInclude = {
  guest: true,
  room: { include: { roomType: true } },
} as const;

function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000));
}

function paymentStatusFor(total: number, advancePaid: number): "PENDING" | "PARTIAL" | "PAID" {
  if (advancePaid >= total) return "PAID";
  if (advancePaid > 0) return "PARTIAL";
  return "PENDING";
}

export async function createBooking(
  session: SessionUser,
  input: CreateBookingInput,
  opts?: { id?: string }
) {
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    include: { roomType: true },
  });
  if (!room) throw new AppError("ROOM_NOT_FOUND", "Room not found.", 404);
  if (room.status === "MAINTENANCE" || room.status === "OUT_OF_SERVICE") {
    throw new AppError(
      "ROOM_NOT_AVAILABLE",
      `Room ${room.number} is ${room.status === "MAINTENANCE" ? "under maintenance" : "out of service"}.`,
      409
    );
  }

  const checkIn = new Date(input.checkIn);
  const checkOut = new Date(input.checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  const rate = toNumber(room.roomType.basePrice);
  const subtotal = round2(rate * nights);

  const settings = await getSettings();
  const taxAmount = round2((subtotal * toNumber(settings.taxRatePct)) / 100);
  const total = round2(subtotal + taxAmount);
  const advancePaid = round2(input.advancePaid ?? 0);
  const balanceDue = round2(Math.max(0, total - advancePaid));

  const booking = await prisma.$transaction(async (tx) => {
    await assertRoomAvailable(input.roomId, checkIn, checkOut, { tx });

    const guest = input.cnic
      ? await tx.guest.upsert({
          where: { cnic: input.cnic },
          update: {},
          create: {
            name: input.guestName,
            cnic: input.cnic,
            passportNo: input.passportNo,
            phone: input.phone,
            address: input.address,
          },
        })
      : await tx.guest.create({
          data: {
            name: input.guestName,
            passportNo: input.passportNo,
            phone: input.phone,
            address: input.address,
          },
        });

    return tx.booking.create({
      data: {
        // When set (offline-sync path), keeps the ID the client already
        // assigned when it created this record while disconnected, so the
        // client never has to remap a local-only id to a server-issued one.
        id: opts?.id,
        roomId: room.id,
        guestId: guest.id,
        checkIn,
        checkOut,
        nights,
        rate,
        subtotal,
        taxAmount,
        total,
        advancePaid,
        balanceDue,
        paymentStatus: paymentStatusFor(total, advancePaid),
        status: "RESERVED",
        notes: input.notes,
        createdById: session.id,
      },
      include: bookingInclude,
    });
  });

  await recordAudit({
    session,
    action: `Reservation created: ${booking.guest.name} → Room ${room.number}`,
    module: "Hotel",
    entityType: "Booking",
    entityId: booking.id,
    details: `${nights} night(s), ${input.checkIn} to ${input.checkOut}, total ${total}`,
  });

  return booking;
}

export async function checkInBooking(session: SessionUser, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Reservation not found.", 404);
  if (booking.status !== "RESERVED") {
    throw new AppError("INVALID_BOOKING_STATE", "Only a reserved booking can be checked in.", 409);
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
      include: bookingInclude,
    }),
    prisma.room.update({ where: { id: booking.roomId }, data: { status: "OCCUPIED" } }),
  ]);

  await recordAudit({
    session,
    action: `Checked in: ${booking.guest.name} → Room ${booking.room.number}`,
    module: "Hotel",
    entityType: "Booking",
    entityId: booking.id,
  });

  return updated;
}

export async function checkOutBooking(session: SessionUser, bookingId: string, input: CheckoutInput) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Reservation not found.", 404);
  if (booking.status !== "CHECKED_IN") {
    throw new AppError("INVALID_BOOKING_STATE", "Only a checked-in booking can be checked out.", 409);
  }

  const finalPayment = round2(input.finalPayment ?? 0);
  const newAdvance = round2(toNumber(booking.advancePaid) + finalPayment);
  const total = toNumber(booking.total);
  const newBalance = round2(Math.max(0, total - newAdvance));

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CHECKED_OUT",
        advancePaid: newAdvance,
        balanceDue: newBalance,
        paymentStatus: paymentStatusFor(total, newAdvance),
        checkedOutAt: new Date(),
        checkedOutById: session.id,
      },
      include: bookingInclude,
    }),
    // Business rule: a checked-out room needs housekeeping before it can be booked again.
    prisma.room.update({ where: { id: booking.roomId }, data: { status: "CLEANING" } }),
  ]);

  if (finalPayment > 0) {
    await prisma.payment.create({
      data: {
        bookingId,
        amount: finalPayment,
        method: input.paymentMethod,
        receivedById: session.id,
      },
    });
  }

  await recordAudit({
    session,
    action: `Checked out: ${booking.guest.name} from Room ${booking.room.number}`,
    module: "Hotel",
    entityType: "Booking",
    entityId: booking.id,
    details: `Payment: ${input.paymentMethod}, balance due: ${newBalance}`,
  });

  return updated;
}

export async function cancelBooking(session: SessionUser, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Reservation not found.", 404);
  if (booking.status !== "RESERVED") {
    throw new AppError(
      "INVALID_BOOKING_STATE",
      "Only a not-yet-checked-in reservation can be cancelled.",
      409
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
    include: bookingInclude,
  });

  await recordAudit({
    session,
    action: `Reservation cancelled: ${booking.guest.name} — Room ${booking.room.number}`,
    module: "Hotel",
    entityType: "Booking",
    entityId: booking.id,
    riskLevel: "LOW",
  });

  return updated;
}

const HIGH_RISK_DISCOUNT_PCT = 15;
const MEDIUM_RISK_DISCOUNT_PCT = 5;

export async function applyBookingDiscount(session: SessionUser, bookingId: string, input: DiscountInput) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw new AppError("BOOKING_NOT_FOUND", "Reservation not found.", 404);
  if (booking.status === "CHECKED_OUT" || booking.status === "CANCELLED") {
    throw new AppError("INVALID_BOOKING_STATE", "Cannot discount a completed or cancelled booking.", 409);
  }

  const grossTotal = round2(toNumber(booking.subtotal) + toNumber(booking.taxAmount));
  const discountAmount = round2((grossTotal * input.percent) / 100);
  const total = round2(grossTotal - discountAmount);
  const advancePaid = toNumber(booking.advancePaid);
  const balanceDue = round2(Math.max(0, total - advancePaid));

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      discountAmount,
      total,
      balanceDue,
      paymentStatus: paymentStatusFor(total, advancePaid),
    },
    include: bookingInclude,
  });

  const riskLevel =
    input.percent >= HIGH_RISK_DISCOUNT_PCT ? "HIGH" : input.percent >= MEDIUM_RISK_DISCOUNT_PCT ? "MEDIUM" : "NONE";

  await recordAudit({
    session,
    action: `Discount ${input.percent}% applied on Room ${booking.room.number}`,
    module: "Hotel",
    entityType: "Booking",
    entityId: booking.id,
    riskLevel,
    details: input.reason,
  });

  if (riskLevel !== "NONE") {
    await recordAlert({
      type: "discount",
      message: `${session.name} applied a ${input.percent}% discount`,
      detail: `Room ${booking.room.number} — ${input.reason}`,
      severity: riskLevel,
      userId: session.id,
    });
  }

  return updated;
}
