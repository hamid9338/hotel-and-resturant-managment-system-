import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateKitchenItemStatusSchema } from "@/lib/validation/restaurant";
import { updateOrderItemStatus } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const session = await requireSession();
    // Reuses the same permission as the order-level status endpoint — a
    // narrower key would just duplicate today's exact role set
    // (owner/manager/waiter/kitchen_staff) with no access-control benefit.
    await requirePermission(session, "restaurant.update_order_status");
    const input = updateKitchenItemStatusSchema.parse(await request.json());
    const { id, itemId } = await params;
    const order = await updateOrderItemStatus(session, id, itemId, input);
    return ok(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
