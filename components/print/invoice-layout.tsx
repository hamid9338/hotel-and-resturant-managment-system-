import Image from "next/image";
import { PrintToolbar } from "@/components/print/print-button";
import { formatCurrency, formatDate } from "@/lib/format";

type Line = { name: string; qty: number | string; amount: number };
export type PrintSize = "a4" | "thermal80" | "thermal58";

/** Shared by both print pages so an unrecognized/missing ?size= value falls back to A4 the same way everywhere. */
export function parsePrintSize(value: string | undefined): PrintSize {
  return value === "thermal80" || value === "thermal58" ? value : "a4";
}

const THERMAL_PAGE_CSS: Record<"thermal80" | "thermal58", string> = {
  thermal80: "@page { size: 80mm auto; margin: 3mm; }",
  thermal58: "@page { size: 58mm auto; margin: 2mm; }",
};

/**
 * Explicit black/white/gray Tailwind colors throughout — not the app's
 * theme tokens — so the page looks the same (and prints correctly) whether
 * the viewer's dashboard is set to light, dark, or system.
 */
export function InvoiceLayout({
  businessName,
  logoUrl,
  currency,
  invoiceNo,
  invoiceDate,
  title,
  billTo,
  lines,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  footnote,
  size = "a4",
}: {
  businessName: string;
  logoUrl?: string | null;
  currency: string;
  invoiceNo: string | null;
  invoiceDate: string | Date;
  title: string;
  billTo?: string | null;
  lines: Line[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  footnote?: string;
  size?: PrintSize;
}) {
  if (size === "thermal80" || size === "thermal58") {
    const width = size === "thermal80" ? "max-w-[80mm]" : "max-w-[58mm]";
    const textSize = size === "thermal80" ? "text-xs" : "text-[10px]";
    return (
      <div className="min-h-dvh bg-white p-2 text-black">
        <style>{THERMAL_PAGE_CSS[size]}</style>
        <PrintToolbar size={size} />
        <div className={`mx-auto ${width} space-y-2 font-mono ${textSize}`}>
          <div className="space-y-0.5 text-center">
            {logoUrl && <Image src={logoUrl} alt="" width={32} height={32} className="mx-auto rounded object-cover" />}
            <div className="font-bold">{businessName}</div>
            <div>{title}</div>
            <div>{invoiceNo ?? "—"}</div>
            <div>{formatDate(invoiceDate)}</div>
          </div>

          {billTo && (
            <div className="border-t border-dashed border-black pt-1">
              <div>Billed to:</div>
              <div className="font-bold">{billTo}</div>
            </div>
          )}

          <div className="space-y-1 border-t border-dashed border-black pt-1">
            {lines.map((l, i) => (
              <div key={i}>
                <div>{l.name}</div>
                <div className="flex justify-between">
                  <span>
                    {l.qty} × {formatCurrency(l.amount / (Number(l.qty) || 1), currency)}
                  </span>
                  <span>{formatCurrency(l.amount, currency)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-0.5 border-t border-dashed border-black pt-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {!!discountAmount && discountAmount > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatCurrency(discountAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatCurrency(taxAmount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-0.5 font-bold">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {footnote && <p className="border-t border-dashed border-black pt-1 text-center">{footnote}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white p-8 text-black">
      <PrintToolbar size={size} />
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && <Image src={logoUrl} alt="" width={48} height={48} className="rounded object-cover" />}
            <h1 className="text-xl font-bold">{businessName}</h1>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{title}</div>
            <div className="text-sm text-gray-500">{invoiceNo ?? "—"}</div>
            <div className="text-sm text-gray-500">{formatDate(invoiceDate)}</div>
          </div>
        </div>

        {billTo && (
          <div className="mb-6 text-sm">
            <div className="text-gray-500">Billed to</div>
            <div className="font-semibold">{billTo}</div>
          </div>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 text-left font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2">{l.name}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{formatCurrency(l.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 max-w-[240px] space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          {!!discountAmount && discountAmount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span>-{formatCurrency(discountAmount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>{formatCurrency(taxAmount, currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-black pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        {footnote && <p className="mt-8 text-xs text-gray-400">{footnote}</p>}
      </div>
    </div>
  );
}
