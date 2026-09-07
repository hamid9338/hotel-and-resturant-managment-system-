import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { supplierSchema } from "@/lib/validation/purchasing";
import { updateSupplier } from "@/lib/services/suppliers";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = supplierSchema.parse(await request.json());
    const { id } = await params;
    const supplier = await updateSupplier(session, id, input);
    return ok(supplier);
  } catch (err) {
    return handleRouteError(err);
  }
}
