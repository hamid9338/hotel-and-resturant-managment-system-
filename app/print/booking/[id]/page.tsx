import { notFound } from "next/navigation";
import { requireSessionForPage } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { toNumber } from "@/lib/money";
import { InvoiceLayout } from "@/components/print/invoice-layout";

// Deliberately not in lib/nav.ts — reached only from a "Print" link on
// already-permissioned pages (bookings-table.tsx, checkout-modal.tsx), not a
// top-level destination. Still independently permission-checked here, since
// nav-gating alone would not stop a direct URL visit.
export default async function PrintBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionForPage();
  await requirePermission(session, "hotel.view");
  const { id } = await params;

  const [booking, settings] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: { guest: true, room: { include: { roomType: true } } },
    }),
    getSettings(),
  ]);
  if (!booking) notFound();

  return (
    <InvoiceLayout
      businessName={settings.businessName}
      logoUrl={settings.logoUrl}
      currency={settings.currency}
      invoiceNo={booking.invoiceNo}
      invoiceDate={booking.checkedOutAt ?? booking.createdAt}
      title="Guest Folio"
      billTo={booking.guest.name}
      lines={[
        {
          name: `Room ${booking.room.number} — ${booking.room.roomType.name} (${booking.nights} night${booking.nights === 1 ? "" : "s"})`,
          qty: booking.nights,
          amount: toNumber(booking.subtotal),
        },
      ]}
      subtotal={toNumber(booking.subtotal)}
      taxAmount={toNumber(booking.taxAmount)}
      discountAmount={toNumber(booking.discountAmount)}
      total={toNumber(booking.total)}
      footnote={`Balance due: ${toNumber(booking.balanceDue)} ${settings.currency}`}
    />
  );
}
