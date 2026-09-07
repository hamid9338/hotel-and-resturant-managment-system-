import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updatePurchaseOrderStatusSchema } from "@/lib/validation/purchasing";
import { updatePurchaseOrderStatus } from "@/lib/services/purchase-orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = updatePurchaseOrderStatusSchema.parse(await request.json());
    const { id } = await params;
    const po = await updatePurchaseOrderStatus(session, id, input);
    return ok(po);
  } catch (err) {
    return handleRouteError(err);
  }
}
