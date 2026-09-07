import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createPurchaseOrderSchema } from "@/lib/validation/purchasing";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/services/purchase-orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.view");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const orders = await listPurchaseOrders({ status });
    return ok(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = createPurchaseOrderSchema.parse(await request.json());
    const po = await createPurchaseOrder(session, input);
    return ok(po, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
