"use client";

import type { PrintSize } from "@/components/print/invoice-layout";

// Isolated client island — the print pages themselves are server components
// with zero other interactivity. Uses the .no-print rule already sitting in
// app/globals.css so this button vanishes in the printed/PDF output.
export function PrintButton() {
  return (
    <div className="no-print mx-auto mb-4 max-w-2xl text-right">
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}

const SIZE_LABELS: Record<PrintSize, string> = {
  a4: "A4",
  thermal80: "80mm Thermal",
  thermal58: "58mm Thermal",
};

/**
 * Same idea as PrintButton, plus size links (plain relative ?size=... hrefs
 * — a full page nav is cheap for a tiny print page and needs no client state
 * of its own) for the two receipt pages (booking/order), which can print at
 * thermal widths. report-layout.tsx keeps using plain PrintButton since a
 * full business report has no sensible thermal rendering.
 */
export function PrintToolbar({ size }: { size: PrintSize }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-2xl items-center justify-between gap-3">
      <div className="flex gap-1.5 text-sm">
        {(Object.keys(SIZE_LABELS) as PrintSize[]).map((s) => (
          <a
            key={s}
            href={`?size=${s}`}
            className={`rounded-lg border px-3 py-1.5 ${
              s === size ? "border-black bg-black text-white" : "border-gray-300 text-gray-700 hover:border-black"
            }`}
          >
            {SIZE_LABELS[s]}
          </a>
        ))}
      </div>
      <button
        onClick={() => window.print()}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
