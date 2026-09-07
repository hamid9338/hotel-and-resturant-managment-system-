"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/field";
import { formatCurrency } from "@/lib/format";
import { round2 } from "@/lib/money";

export type PaymentEntry = { method: string; amount: string };

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK", label: "Bank" },
  { value: "CARD", label: "Card" },
];

/**
 * Shared by BillOrderModal and CheckoutModal — a list of {method, amount}
 * rows with add/remove, used to split one settlement across payment methods.
 * `targetTotal`, when given, must be matched exactly (order billing); omit it
 * for an unconstrained sum (booking checkout, which can be less than what's
 * owed).
 */
export function PaymentSplitFields({
  entries,
  onChange,
  currency,
  targetTotal,
}: {
  entries: PaymentEntry[];
  onChange: (entries: PaymentEntry[]) => void;
  currency: string;
  targetTotal?: number;
}) {
  const sum = round2(entries.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const mismatched = targetTotal !== undefined && sum !== round2(targetTotal);

  const update = (i: number, patch: Partial<PaymentEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const addRow = () => onChange([...entries, { method: "CASH", amount: "" }]);
  const removeRow = (i: number) => onChange(entries.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            {i === 0 && <Label>Payment Method</Label>}
            <Select value={entry.method} onChange={(e) => update(i, { method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            {i === 0 && <Label>Amount</Label>}
            <Input type="number" min={0} value={entry.amount} onChange={(e) => update(i, { amount: e.target.value })} />
          </div>
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="mb-2 shrink-0 text-muted hover:text-danger"
              aria-label="Remove payment"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
      {entries.length < 4 && (
        <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs text-accent hover:underline">
          <Plus size={12} /> Split into another payment method
        </button>
      )}
      <div className="flex items-center justify-between border-t border-border-default pt-2 text-sm">
        <span className="text-muted">Total entered</span>
        <span className={`font-mono ${mismatched ? "text-danger" : ""}`}>
          {formatCurrency(sum, currency)}
          {targetTotal !== undefined && ` / ${formatCurrency(round2(targetTotal), currency)}`}
        </span>
      </div>
    </div>
  );
}
