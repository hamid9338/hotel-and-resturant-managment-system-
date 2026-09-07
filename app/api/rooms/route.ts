import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, fail, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    const canViewAll = await hasPermission(session, "hotel.view");
    const canViewCleaning = await hasPermission(session, "hotel.view_cleaning");
    if (!canViewAll && !canViewCleaning) return fail("FORBIDDEN", "Access denied.", 403);

    const rooms = await prisma.room.findMany({
      where: canViewAll ? undefined : { status: "CLEANING" },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: ["RESERVED", "CHECKED_IN"] } },
          include: { guest: true },
          orderBy: { checkIn: "asc" },
        },
      },
      orderBy: { number: "asc" },
    });

    const shaped = rooms.map(({ bookings, ...room }) => ({
      ...room,
      activeBooking: bookings.find((b) => b.status === "CHECKED_IN") ?? null,
      upcomingBookings: bookings.filter((b) => b.status === "RESERVED"),
    }));

    return ok(shaped);
  } catch (err) {
    return handleRouteError(err);
  }
}
