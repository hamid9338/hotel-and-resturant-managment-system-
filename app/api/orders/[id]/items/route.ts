import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { addOrderItemsSchema } from "@/lib/validation/restaurant";
import { addOrderItems } from "@/lib/services/orders";
import { recordLocalMutation } from "@/lib/services/local-cloud-sync";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.create_order");
    const input = addOrderItemsSchema.parse(await request.json());
    const { id } = await params;
    const order = await addOrderItems(session, id, input);
    await recordLocalMutation(session, {
      operationKind: "orders.addItems",
      entityId: order.id,
      payload: { orderId: id, ...input },
    });
    return ok(order);
  } catch (err) {
    return handleRouteError(err);
  }
}
