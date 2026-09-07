import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getUnbilledRoomServiceOrders } from "@/lib/services/orders";
import { ok, fail, handleRouteError } from "@/lib/api/respond";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.view");
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!booking) return fail("BOOKING_NOT_FOUND", "Reservation not found.", 404);

    const unbilledRoomService = await getUnbilledRoomServiceOrders(id);
    return ok({ ...booking, unbilledRoomService });
  } catch (err) {
    return handleRouteError(err);
  }
}
