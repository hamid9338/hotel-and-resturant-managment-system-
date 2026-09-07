import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { supplierSchema } from "@/lib/validation/purchasing";
import { createSupplier, listSuppliers } from "@/lib/services/suppliers";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.view");
    const suppliers = await listSuppliers();
    return ok(suppliers);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await requirePermission(session, "inventory.manage");
    const input = supplierSchema.parse(await request.json());
    const supplier = await createSupplier(session, input);
    return ok(supplier, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
