import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { refundOrderSchema } from "@/lib/validation/restaurant";
import { refundOrderPayment } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "finance.refund");
    const input = refundOrderSchema.parse(await request.json());
    const { id } = await params;
    const payment = await refundOrderPayment(session, id, input);
    return ok(payment, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
