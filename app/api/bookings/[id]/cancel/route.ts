import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { cancelBooking } from "@/lib/services/bookings";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.cancel_booking");
    const { id } = await params;
    const booking = await cancelBooking(session, id);
    return ok(booking);
  } catch (err) {
    return handleRouteError(err);
  }
}
