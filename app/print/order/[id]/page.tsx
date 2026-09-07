import { notFound } from "next/navigation";
import { requireSessionForPage } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/services/settings";
import { round2, toNumber } from "@/lib/money";
import { InvoiceLayout } from "@/components/print/invoice-layout";

// See app/print/booking/[id]/page.tsx for why this is deliberately outside lib/nav.ts.
export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionForPage();
  await requirePermission(session, "restaurant.view");
  const { id } = await params;

  const [order, settings] = await Promise.all([
    prisma.restaurantOrder.findUnique({
      where: { id },
      include: { items: true, table: true },
    }),
    getSettings(),
  ]);
  if (!order) notFound();

  return (
    <InvoiceLayout
      businessName={settings.businessName}
      logoUrl={settings.logoUrl}
      currency={settings.currency}
      invoiceNo={order.invoiceNo}
      invoiceDate={order.billedAt ?? order.createdAt}
      title="Receipt"
      billTo={order.table ? order.table.label : order.orderType.replace(/_/g, " ")}
      lines={order.items.map((line) => ({
        name: line.nameSnapshot,
        qty: line.qty,
        amount: round2(toNumber(line.priceSnapshot) * line.qty),
      }))}
      subtotal={toNumber(order.subtotal)}
      taxAmount={toNumber(order.taxAmount)}
      discountAmount={toNumber(order.discountAmount)}
      total={toNumber(order.total)}
    />
  );
}
