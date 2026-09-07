import { requireSession } from "@/lib/auth/session";
import { getRolePermissionKeys } from "@/lib/auth/permissions";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    const permissionKeys = await getRolePermissionKeys(session.roleId);
    return ok({
      user: {
        id: session.id,
        name: session.name,
        username: session.username,
        role: session.roleName,
        shift: session.shift,
      },
      permissions: [...permissionKeys],
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
