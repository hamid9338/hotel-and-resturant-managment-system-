import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateInventoryItemSchema } from "@/lib/validation/inventory";
import { updateInventoryItem } from "@/lib/services/inventory";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = updateInventoryItemSchema.parse(await request.json());
    const { id } = await params;
    const item = await updateInventoryItem(session, id, input);
    return ok(item);
  } catch (err) {
    return handleRouteError(err);
  }
}
