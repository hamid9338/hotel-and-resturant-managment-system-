import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createBookingSchema } from "@/lib/validation/hotel";
import { createBooking } from "@/lib/services/bookings";
import { prisma } from "@/lib/db";
import { ok, handleRouteError } from "@/lib/api/respond";
import { toCsv, csvResponse } from "@/lib/csv";
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

    if (searchParams.get("format") === "csv") {
      const csv = toCsv(
        [
          "Invoice",
          "Guest",
          "Phone",
          "Room",
          "Check In",
          "Check Out",
          "Nights",
          "Rate",
          "Subtotal",
          "Tax",
          "Discount",
          "Total",
          "Advance Paid",
          "Balance Due",
          "Payment Status",
          "Status",
          "Created At",
        ],
        bookings.map((b) => [
          b.invoiceNo,
          b.guest.name,
          b.guest.phone,
          b.room.number,
          b.checkIn.toISOString(),
          b.checkOut.toISOString(),
          b.nights,
          b.rate.toString(),
          b.subtotal.toString(),
          b.taxAmount.toString(),
          b.discountAmount.toString(),
          b.total.toString(),
          b.advancePaid.toString(),
          b.balanceDue.toString(),
          b.paymentStatus,
          b.status,
          b.createdAt.toISOString(),
        ])
      );
      return csvResponse("bookings.csv", csv);
    }

    return ok(bookings);
  } catch (err) {
    return handleRouteError(err);
  }
}
