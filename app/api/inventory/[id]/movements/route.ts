import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listStockMovements } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.view");
    const { id } = await params;
    const movements = await listStockMovements(id);
    return ok(movements);
  } catch (err) {
    return handleRouteError(err);
  }
}
