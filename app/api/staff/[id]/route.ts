import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateStaffSchema } from "@/lib/validation/staff";
import { updateStaff } from "@/lib/services/staff";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "staff.edit");
    const input = updateStaffSchema.parse(await request.json());
    const { id } = await params;
    const staff = await updateStaff(session, id, input, session.roleName);
    return ok(staff);
  } catch (err) {
    return handleRouteError(err);
  }
}
