import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createOrderSchema } from "@/lib/validation/restaurant";
import { createOrder, listOrders } from "@/lib/services/orders";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.create_order");
    const input = createOrderSchema.parse(await request.json());
    const order = await createOrder(session, input);
    return ok(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.view");
    const { searchParams } = request.nextUrl;
    const orders = await listOrders({
      status: searchParams.get("status") ?? undefined,
      tableId: searchParams.get("tableId") ?? undefined,
      date: searchParams.get("date") ?? undefined,
    });
    return ok(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}
