import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { checkInBooking } from "@/lib/services/bookings";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.checkin");
    const { id } = await params;
    const booking = await checkInBooking(session, id);
    return ok(booking);
  } catch (err) {
    return handleRouteError(err);
  }
}
