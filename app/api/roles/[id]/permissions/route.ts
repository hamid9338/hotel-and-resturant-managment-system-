import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateRolePermissionsSchema } from "@/lib/validation/roles";
import { updateRolePermissions } from "@/lib/services/roles";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "staff.manage_roles");
    const { id } = await params;
    const input = updateRolePermissionsSchema.parse(await request.json());
    const data = await updateRolePermissions(session, id, input);
    return ok(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
