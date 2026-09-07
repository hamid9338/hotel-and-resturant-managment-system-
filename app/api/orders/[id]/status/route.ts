import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateOrderStatusSchema } from "@/lib/validation/restaurant";
import { updateOrderStatus } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.update_order_status");
    const input = updateOrderStatusSchema.parse(await request.json());

    // Cancelling is a second, higher-bar permission — only owner/manager get
    // it in the seeded roles — same "two-tier" check the prototype made
    // inline for this one status value.
    if (input.status === "CANCELLED") {
      await requirePermission(session, "restaurant.cancel_order");
    }

    const { id } = await params;
    const order = await updateOrderStatus(session, id, input);
    return ok(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
