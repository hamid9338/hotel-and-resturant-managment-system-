import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { updateMaintenanceTicketSchema } from "@/lib/validation/maintenance";
import { updateMaintenanceTicket } from "@/lib/services/maintenance";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.manage_maintenance");
    const input = updateMaintenanceTicketSchema.parse(await request.json());
    const { id } = await params;
    const ticket = await updateMaintenanceTicket(session, id, input);
    return ok(ticket);
  } catch (err) {
    return handleRouteError(err);
  }
}
