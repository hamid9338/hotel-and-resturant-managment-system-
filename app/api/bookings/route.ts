import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createBookingSchema } from "@/lib/validation/hotel";
import { createBooking } from "@/lib/services/bookings";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";
import type { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.create_booking");
    const input = createBookingSchema.parse(await request.json());
    const booking = await createBooking(session, input);
    return ok(booking, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.view");
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const roomId = searchParams.get("roomId");

    const bookings = await prisma.booking.findMany({
      where: {
        status: status ? (status as Prisma.EnumBookingStatusFilter["equals"]) : undefined,
        roomId: roomId || undefined,
      },
      include: { guest: true, room: { include: { roomType: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(bookings);
  } catch (err) {
    return handleRouteError(err);
  }
}
