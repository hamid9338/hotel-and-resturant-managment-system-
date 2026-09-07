import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { discountSchema } from "@/lib/validation/hotel";
import { applyBookingDiscount } from "@/lib/services/bookings";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.discount");
    const input = discountSchema.parse(await request.json());
    const { id } = await params;
    const booking = await applyBookingDiscount(session, id, input);
    return ok(booking);
  } catch (err) {
    return handleRouteError(err);
  }
}
