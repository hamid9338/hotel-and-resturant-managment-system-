import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { availabilityQuerySchema } from "@/lib/validation/hotel";
import { findConflictingBookings } from "@/lib/services/availability";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.view");
    const { searchParams } = request.nextUrl;
    const input = availabilityQuerySchema.parse({
      roomId: searchParams.get("roomId"),
      checkIn: searchParams.get("checkIn"),
      checkOut: searchParams.get("checkOut"),
    });
    const conflicts = await findConflictingBookings(input.roomId, new Date(input.checkIn), new Date(input.checkOut));
    return ok({ available: conflicts.length === 0, conflicts });
  } catch (err) {
    return handleRouteError(err);
  }
}
