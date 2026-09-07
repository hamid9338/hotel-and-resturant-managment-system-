"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

type OcrItem = { name: string; qty: string; unit: number; total: number };
type InventoryItemRef = { id: string; name: string; unit: string };
type LineMap = { inventoryItemId: string; quantity: string; unitCost: string; skip: boolean };

/**
 * OCR line items are free-text ("5 kg", "2 dozen") — no automatic match to
 * an InventoryItem, so staff map each line by hand (or mark it "not stock,"
 * e.g. a delivery fee) and enter a clean quantity/cost.
 */
export function PostOcrModal({
  billId,
  items,
  onClose,
  onDone,
}: {
  billId: string;
  items: OcrItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRef[]>([]);
  const [lines, setLines] = useState<LineMap[]>(
    items.map((it) => ({ inventoryItemId: "", quantity: "", unitCost: String(it.unit ?? ""), skip: false }))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<InventoryItemRef[]>("/api/inventory")
      .then(setInventoryItems)
      .catch(() => {});
  }, []);

  const updateLine = (i: number, patch: Partial<LineMap>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const mappedLines = lines
    .map((l, i) => ({ ...l, ocrItem: items[i] }))
    .filter((l) => !l.skip && l.inventoryItemId && Number(l.quantity) > 0);
  const canSubmit = mappedLines.length > 0;

  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/api/ocr/bills/${billId}/post-inventory`, {
        lines: mappedLines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
        })),
      });
      toast.success("Posted to inventory");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post to inventory.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Post to Inventory"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSubmit} onClick={submit}>
            Post {mappedLines.length} Line{mappedLines.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted">
          Map each scanned line to a stock item, or skip lines that aren&rsquo;t stock (delivery fees, etc.).
        </p>
        {items.map((item, i) => (
          <div key={i} className="flex items-end gap-2 border-b border-border-default pb-2 last:border-0">
            <div className="flex-1 text-xs text-muted">
              <div className="font-medium text-foreground">{item.name}</div>
              <div>scanned: {item.qty}</div>
            </div>
            <div className="flex-1">
              <Label>Stock Item</Label>
              <Select
                value={lines[i].inventoryItemId}
                onChange={(e) => updateLine(i, { inventoryItemId: e.target.value })}
                disabled={lines[i].skip}
              >
                <option value="">Not stock / skip</option>
                {inventoryItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.unit})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <Label>Qty</Label>
              <Input
                type="number"
                min={0}
                value={lines[i].quantity}
                onChange={(e) => updateLine(i, { quantity: e.target.value })}
                disabled={!lines[i].inventoryItemId}
              />
            </div>
            <div className="w-28">
              <Label>Unit Cost</Label>
              <Input
                type="number"
                min={0}
                value={lines[i].unitCost}
                onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                disabled={!lines[i].inventoryItemId}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
