import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { billOrderSchema } from "@/lib/validation/restaurant";
import { billOrder } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.bill_order");
    const input = billOrderSchema.parse(await request.json());
    const { id } = await params;
    const order = await billOrder(session, id, input);
    return ok(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
