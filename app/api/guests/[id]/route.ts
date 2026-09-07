import { requireSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { toNumber, round2 } from "@/lib/money";
import { ok, fail, handleRouteError } from "@/lib/api/respond";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    await requirePermission(session, "hotel.view");
    const { id } = await params;
    const guest = await prisma.guest.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: { include: { roomType: true } }, payments: true },
          orderBy: { checkIn: "desc" },
        },
      },
    });
    if (!guest) return fail("GUEST_NOT_FOUND", "Guest not found.", 404);

    // advancePaid always reflects everything received to date for a booking
    // (initial advance + any later payments folded in at checkout), so it is
    // the one number to sum here — summing the Payment ledger rows too would
    // double-count the portion that both records already capture.
    const totalSpending = round2(guest.bookings.reduce((sum, b) => sum + toNumber(b.advancePaid), 0));
    const outstandingBalance = round2(guest.bookings.reduce((sum, b) => sum + toNumber(b.balanceDue), 0));

    return ok({ ...guest, totalVisits: guest.bookings.length, totalSpending, outstandingBalance });
  } catch (err) {
    return handleRouteError(err);
  }
}
