import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createStaffSchema } from "@/lib/validation/staff";
import { createStaff, listStaff } from "@/lib/services/staff";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "staff.view_all");
    const staff = await listStaff();
    return ok(staff);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await requirePermission(session, "staff.create");
    const input = createStaffSchema.parse(await request.json());
    const staff = await createStaff(session, input);
    return ok(staff, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
