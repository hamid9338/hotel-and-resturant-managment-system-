import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/api/respond";
import type { Prisma } from "@prisma/client";

const ACTIVE_BOOKING_STATUSES = ["RESERVED", "CHECKED_IN"] as const;

/**
 * Availability for a date range is a question about Booking rows, not
 * Room.status (which only tracks whether housekeeping/maintenance has the
 * room ready right now — see the Room model comment). Two stays overlap when
 * their [checkIn, checkOut) intervals intersect; the comparison is strictly
 * < / > (not <=/>=) so a checkout the same morning as a new check-in is
 * legal same-day turnover, not a conflict.
 *
 * This is also enforced at the database layer by a Postgres EXCLUDE
 * constraint added by hand to the initial migration (see
 * prisma/migrations/*_init/migration.sql) — this function is the
 * application-level check that produces a friendly error before that
 * constraint would ever fire, and is shared by both the online booking route
 * and the offline-sync dispatcher so both paths get the same guarantee.
 */
export async function findConflictingBookings(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  opts?: { excludeBookingId?: string; tx?: Prisma.TransactionClient }
) {
  const db = opts?.tx ?? prisma;
  return db.booking.findMany({
    where: {
      roomId,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(opts?.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
    },
    include: { guest: true },
  });
}

export async function assertRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  opts?: { excludeBookingId?: string; tx?: Prisma.TransactionClient }
): Promise<void> {
  const conflicts = await findConflictingBookings(roomId, checkIn, checkOut, opts);
  if (conflicts.length > 0) {
    throw new AppError(
      "ROOM_NOT_AVAILABLE",
      `Room is already booked for part of that date range (conflicts with ${conflicts
        .map((b) => b.guest.name)
        .join(", ")}).`,
      409
    );
  }
}
