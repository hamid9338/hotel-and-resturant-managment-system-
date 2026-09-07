"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

export function DiscountModal({
  bookingId,
  onClose,
  onDone,
}: {
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [percent, setPercent] = useState("10");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await api.post(`/api/bookings/${bookingId}/discount`, { percent: Number(percent), reason });
      toast.success(`${percent}% discount applied`);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply discount.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Apply Discount"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!reason.trim()} onClick={submit}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label required>Discount %</Label>
          <Input type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
        <div>
          <Label required>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Loyal returning guest" />
        </div>
        <FieldError>{error}</FieldError>
      </div>
    </Modal>
  );
}
