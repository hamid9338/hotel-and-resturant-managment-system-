"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { PaymentSplitFields, type PaymentEntry } from "@/components/shared/payment-split-fields";

export function CheckoutModal({
  bookingId,
  currency,
  onClose,
  onDone,
}: {
  bookingId: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  // Unlike order billing, checkout's sum is unconstrained — a guest can leave
  // owing a balance, so a blank/zero amount is valid (filtered out on submit,
  // resulting in an empty payments[] the same as the old finalPayment: 0).
  const [entries, setEntries] = useState<PaymentEntry[]>([{ method: "CASH", amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [unbilledTotal, setUnbilledTotal] = useState(0);

  useEffect(() => {
    api
      .get<{ unbilledRoomService: { total: number } }>(`/api/bookings/${bookingId}`)
      .then((b) => setUnbilledTotal(b.unbilledRoomService.total))
      .catch(() => {});
  }, [bookingId]);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/api/bookings/${bookingId}/checkout`, {
        payments: entries
          .filter((e) => Number(e.amount) > 0)
          .map((e) => ({ method: e.method, amount: Number(e.amount) })),
      });
      toast.success("Guest checked out");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not check out.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Checkout"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={submit}>
            Confirm Checkout
          </Button>
        </>
      }
    >
      {unbilledTotal > 0 && (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          This stay has {formatCurrency(unbilledTotal, currency)} in unpaid room-service orders. Bill them
          separately from the Orders page.
        </div>
      )}
      <PaymentSplitFields entries={entries} onChange={setEntries} currency={currency} />
    </Modal>
  );
}
