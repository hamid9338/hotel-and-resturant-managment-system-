import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, fail, handleRouteError } from "@/lib/api/respond";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!(await hasPermission(session, "hotel.view")) && !(await hasPermission(session, "hotel.view_cleaning"))) {
      return fail("FORBIDDEN", "Access denied.", 403);
    }
    const { id } = await params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        roomType: true,
        bookings: {
          where: { status: { in: ["RESERVED", "CHECKED_IN"] } },
          include: { guest: true },
          orderBy: { checkIn: "asc" },
        },
      },
    });
    if (!room) return fail("ROOM_NOT_FOUND", "Room not found.", 404);
    return ok(room);
  } catch (err) {
    return handleRouteError(err);
  }
}
