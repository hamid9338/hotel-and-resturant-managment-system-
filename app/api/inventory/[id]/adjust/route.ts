import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { adjustStockSchema } from "@/lib/validation/inventory";
import { adjustStock } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.adjust_stock");
    const input = adjustStockSchema.parse(await request.json());
    const { id } = await params;
    const item = await adjustStock(session, id, input);
    return ok(item);
  } catch (err) {
    return handleRouteError(err);
  }
}
