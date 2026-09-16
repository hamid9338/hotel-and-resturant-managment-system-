import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { guestSchema } from "@/lib/validation/hotel";
import { recordAudit } from "@/lib/services/audit";
import { ok, handleRouteError } from "@/lib/api/respond";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.view");
    const q = request.nextUrl.searchParams.get("q")?.trim();
    // "active" is used by the announcements audience picker to preview who a
    // send will reach — uncapped, since staff need the real count, not a
    // browsing-sized sample. The default (q-only) path is unchanged.
    const audience = request.nextUrl.searchParams.get("audience");
    const guests = await prisma.guest.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { cnic: { contains: q } },
              ],
            }
          : {}),
        ...(audience === "active" ? { bookings: { some: { status: { in: ["RESERVED", "CHECKED_IN"] } } } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: audience ? undefined : 50,
    });
    return ok(guests);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.create_booking");
    const input = guestSchema.parse(await request.json());
    const guest = await prisma.guest.create({ data: input });
    await recordAudit({
      session,
      action: `Guest created: ${guest.name}`,
      module: "Hotel",
      entityType: "Guest",
      entityId: guest.id,
    });
    return ok(guest, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
