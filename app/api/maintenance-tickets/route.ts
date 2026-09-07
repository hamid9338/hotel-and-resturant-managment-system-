import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createMaintenanceTicketSchema } from "@/lib/validation/maintenance";
import { createMaintenanceTicket, listMaintenanceTickets } from "@/lib/services/maintenance";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.manage_maintenance");
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const tickets = await listMaintenanceTickets({ status });
    return ok(tickets);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    // Ticket creation reuses hotel.update_room_status — the exact permission
    // that already gates "Report Issue" (held by housekeeper); the ticket
    // dashboard itself (GET above) needs the narrower hotel.manage_maintenance.
    await requirePermission(session, "hotel.update_room_status");
    const input = createMaintenanceTicketSchema.parse(await request.json());
    const ticket = await createMaintenanceTicket(session, input);
    return ok(ticket, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
