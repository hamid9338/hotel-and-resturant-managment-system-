import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { checkoutSchema } from "@/lib/validation/hotel";
import { checkOutBooking } from "@/lib/services/bookings";
import { getUnbilledRoomServiceOrders } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.checkout");
    const input = checkoutSchema.parse(await request.json());
    const { id } = await params;
    const booking = await checkOutBooking(session, id, input);
    const unbilledRoomService = await getUnbilledRoomServiceOrders(id);
    return ok({ booking, unbilledRoomService });
  } catch (err) {
    return handleRouteError(err);
  }
}
