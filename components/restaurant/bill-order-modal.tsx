"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { round2 } from "@/lib/money";
import { PaymentSplitFields, type PaymentEntry } from "@/components/shared/payment-split-fields";

export function BillOrderModal({
  orderId,
  total,
  currency,
  onClose,
  onDone,
}: {
  orderId: string;
  total: number;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [entries, setEntries] = useState<PaymentEntry[]>([{ method: "CASH", amount: String(total) }]);
  const [loading, setLoading] = useState(false);

  const sum = round2(entries.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const canSubmit = sum === round2(total) && entries.every((e) => Number(e.amount) > 0);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/api/orders/${orderId}/bill`, {
        payments: entries.map((e) => ({ method: e.method, amount: Number(e.amount) })),
      });
      toast.success("Order billed");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not bill order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Settle Bill"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSubmit} onClick={submit}>
            Confirm Payment
          </Button>
        </>
      }
    >
      <PaymentSplitFields entries={entries} onChange={setEntries} currency={currency} targetTotal={total} />
    </Modal>
  );
}
