"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "EASYPAISA", label: "Easypaisa" },
  { value: "JAZZCASH", label: "JazzCash" },
  { value: "BANK", label: "Bank" },
  { value: "CARD", label: "Card" },
];

/**
 * Shared between a settled restaurant order and a checked-out booking —
 * same shape (amount + method + required reason), different endpoint.
 * Always HIGH-risk audit + an alert server-side; this modal has no special
 * styling for that beyond the required reason field.
 */
export function RefundModal({
  entityType,
  entityId,
  onClose,
  onDone,
}: {
  entityType: "order" | "booking";
  entityId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = Number(amount) > 0 && reason.trim().length >= 3;
  const endpoint = entityType === "order" ? `/api/orders/${entityId}/refund` : `/api/bookings/${entityId}/refund`;

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(endpoint, { amount: Number(amount), method, reason: reason.trim() });
      toast.success("Refund recorded");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not process refund.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Issue Refund"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} disabled={!canSubmit} onClick={submit}>
            Confirm Refund
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Refund Amount</Label>
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Refund Method</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Reason (required)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
      </div>
    </Modal>
  );
}
