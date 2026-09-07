import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { refundBookingSchema } from "@/lib/validation/hotel";
import { refundBookingPayment } from "@/lib/services/bookings";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.refund");
    const input = refundBookingSchema.parse(await request.json());
    const { id } = await params;
    const payment = await refundBookingPayment(session, id, input);
    return ok(payment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
