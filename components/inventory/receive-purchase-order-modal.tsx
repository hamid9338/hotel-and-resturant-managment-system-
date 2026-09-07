"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { round2 } from "@/lib/money";

type POItem = {
  id: string;
  quantityOrdered: string;
  quantityReceived: string;
  inventoryItem: { id: string; name: string; unit: string };
};
type PO = { id: string; items: POItem[]; supplier: { name: string } };

/**
 * One receiving event against a PO — quantityReceived accumulates across
 * possibly-several of these (multi-delivery partial receiving), so this only
 * shows lines still outstanding and lets staff enter what arrived *this*
 * delivery, not a running total.
 */
export function ReceivePurchaseOrderModal({ po, onClose, onDone }: { po: PO; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const outstanding = po.items.filter((l) => round2(Number(l.quantityOrdered) - Number(l.quantityReceived)) > 0);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const canSubmit = Object.values(amounts).some((v) => Number(v) > 0);

  const submit = async () => {
    setLoading(true);
    try {
      const lines = Object.entries(amounts)
        .filter(([, v]) => Number(v) > 0)
        .map(([poItemId, v]) => ({ poItemId, quantityReceivedNow: Number(v) }));
      await api.post(`/api/purchase-orders/${po.id}/receive`, { lines });
      toast.success("Delivery recorded");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not record delivery.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Receive Delivery — ${po.supplier.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSubmit} onClick={submit}>
            Record Delivery
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Enter what arrived in <strong>this</strong> delivery. Leave a line blank if nothing for it arrived yet — you
          can receive the rest in a later delivery.
        </p>
        {outstanding.map((line) => {
          const remaining = round2(Number(line.quantityOrdered) - Number(line.quantityReceived));
          return (
            <div key={line.id} className="flex items-end gap-2">
              <div className="flex-1">
                <Label>
                  {line.inventoryItem.name} — {remaining} {line.inventoryItem.unit} remaining
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={remaining}
                  value={amounts[line.id] ?? ""}
                  onChange={(e) => setAmounts({ ...amounts, [line.id]: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
