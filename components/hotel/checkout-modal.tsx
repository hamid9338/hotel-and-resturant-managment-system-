"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";

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
  const [finalPayment, setFinalPayment] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
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
        finalPayment: Number(finalPayment) || 0,
        paymentMethod,
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
      <div className="space-y-3">
        <div>
          <Label>Final Payment (if settling any balance now)</Label>
          <Input type="number" min={0} value={finalPayment} onChange={(e) => setFinalPayment(e.target.value)} />
        </div>
        <div>
          <Label>Payment Method</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="BANK">Bank</option>
            <option value="CARD">Card</option>
          </Select>
        </div>
      </div>
    </Modal>
  );
}
