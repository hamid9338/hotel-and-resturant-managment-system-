import Image from "next/image";
import { PrintButton } from "@/components/print/print-button";
import { formatCurrency, formatDateTime } from "@/lib/format";

type Summary = {
  hotelRevenue: number;
  restaurantRevenue: number;
  totalRevenue: number;
  estimatedProfit: number;
  totalBookings: number;
  totalOrders: number;
  outstandingPayments: number;
  roomStats: Record<string, number>;
};

type DailyRow = { date: string; hotel: number; restaurant: number };

/**
 * Explicit black/white/gray Tailwind colors, same convention as
 * InvoiceLayout — the page looks and prints the same regardless of the
 * viewer's live dashboard theme. Structurally different from InvoiceLayout
 * on purpose: a business report is a KPI grid + a trend table, not a single
 * itemized-lines-plus-total shape.
 */
export function ReportPrintLayout({
  businessName,
  logoUrl,
  currency,
  periodLabel,
  generatedAt,
  summary,
  daily,
}: {
  businessName: string;
  logoUrl?: string | null;
  currency: string;
  periodLabel: string;
  generatedAt: Date;
  summary: Summary;
  daily: DailyRow[];
}) {
  const stat = (label: string, value: string) => (
    <div className="rounded border border-gray-300 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-white p-8 text-black">
      <PrintButton />
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && <Image src={logoUrl} alt="" width={48} height={48} className="rounded object-cover" />}
            <h1 className="text-xl font-bold">{businessName}</h1>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">Business Report</div>
            <div className="text-sm text-gray-500">{periodLabel}</div>
            <div className="text-sm text-gray-500">Generated {formatDateTime(generatedAt)}</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {stat("Total Revenue", formatCurrency(summary.totalRevenue, currency))}
          {stat("Hotel Revenue", formatCurrency(summary.hotelRevenue, currency))}
          {stat("Restaurant Revenue", formatCurrency(summary.restaurantRevenue, currency))}
          {stat("Estimated Profit", formatCurrency(summary.estimatedProfit, currency))}
          {stat("Bookings", String(summary.totalBookings))}
          {stat("Orders", String(summary.totalOrders))}
        </div>

        <div className="mb-6">
          <div className="mb-2 text-sm font-semibold">Room Status</div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            {Object.entries(summary.roomStats).map(([status, count]) => (
              <span key={status}>
                {status}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="mb-2 text-sm font-semibold">Daily Revenue</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-1.5 text-left font-semibold">Date</th>
              <th className="py-1.5 text-right font-semibold">Hotel</th>
              <th className="py-1.5 text-right font-semibold">Restaurant</th>
              <th className="py-1.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date} className="border-b border-gray-200">
                <td className="py-1.5">{d.date}</td>
                <td className="py-1.5 text-right">{formatCurrency(d.hotel, currency)}</td>
                <td className="py-1.5 text-right">{formatCurrency(d.restaurant, currency)}</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(d.hotel + d.restaurant, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-8 text-xs text-gray-400">
          Outstanding payments as of report date: {formatCurrency(summary.outstandingPayments, currency)}
        </p>
      </div>
    </div>
  );
}
