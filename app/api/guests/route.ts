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
    const guests = await prisma.guest.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { cnic: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
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
