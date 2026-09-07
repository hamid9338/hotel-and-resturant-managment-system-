import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listRolesWithPermissions } from "@/lib/services/roles";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "staff.manage_roles");
    const data = await listRolesWithPermissions();
    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
