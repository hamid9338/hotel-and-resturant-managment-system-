import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { receivePurchaseOrderSchema } from "@/lib/validation/purchasing";
import { receivePurchaseOrder } from "@/lib/services/purchase-orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = receivePurchaseOrderSchema.parse(await request.json());
    const { id } = await params;
    const po = await receivePurchaseOrder(session, id, input);
    return ok(po);
  } catch (err) {
    return handleRouteError(err);
  }
}
