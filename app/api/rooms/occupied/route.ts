import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";

// A deliberately narrow endpoint: waiters/cashiers can place a room-service
// order (restaurant.create_order) without needing the broader hotel.view
// permission that the full /api/rooms listing requires.
export async function GET() {
  try {
    const session = await requireSession();
    await requirePermission(session, "restaurant.create_order");
    const rooms = await prisma.room.findMany({
      where: { status: "OCCUPIED" },
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    });
    return ok(rooms);
  } catch (err) {
    return handleRouteError(err);
  }
}
