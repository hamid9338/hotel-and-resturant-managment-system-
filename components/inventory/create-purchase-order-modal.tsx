"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { round2 } from "@/lib/money";
import { formatCurrency } from "@/lib/format";

type Supplier = { id: string; name: string };
type InventoryItem = { id: string; name: string; unit: string };
type Line = { inventoryItemId: string; quantityOrdered: string; unitCost: string };

export function CreatePurchaseOrderModal({
  suppliers,
  items,
  currency,
  onClose,
  onDone,
}: {
  suppliers: Supplier[];
  items: InventoryItem[];
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ inventoryItemId: items[0]?.id ?? "", quantityOrdered: "", unitCost: "" }]);
  const [loading, setLoading] = useState(false);

  const total = round2(
    lines.reduce((sum, l) => sum + (Number(l.quantityOrdered) || 0) * (Number(l.unitCost) || 0), 0)
  );
  const canSubmit =
    supplierId && lines.length > 0 && lines.every((l) => l.inventoryItemId && Number(l.quantityOrdered) > 0);

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines([...lines, { inventoryItemId: items[0]?.id ?? "", quantityOrdered: "", unitCost: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const submit = async () => {
    setLoading(true);
    try {
      await api.post("/api/purchase-orders", {
        supplierId,
        notes: notes.trim() || undefined,
        items: lines.map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantityOrdered: Number(l.quantityOrdered),
          unitCost: Number(l.unitCost) || 0,
        })),
      });
      toast.success("Purchase order created");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create purchase order.");
    } finally {
      setLoading(false);
    }
  };

  if (suppliers.length === 0 || items.length === 0) {
    return (
      <Modal title="New Purchase Order" onClose={onClose}>
        <p className="text-sm text-muted">
          {suppliers.length === 0 ? "Add a supplier first." : "Add an inventory item first."}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="New Purchase Order"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} disabled={!canSubmit} onClick={submit}>
            Create ({formatCurrency(total, currency)})
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Supplier</Label>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Line Items</Label>
          {lines.map((line, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-[2]">
                <Select value={line.inventoryItemId} onChange={(e) => updateLine(i, { inventoryItemId: e.target.value })}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.unit})
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                type="number"
                min={0}
                placeholder="Qty"
                value={line.quantityOrdered}
                onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })}
                className="w-24"
              />
              <Input
                type="number"
                min={0}
                placeholder="Unit cost"
                value={line.unitCost}
                onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                className="w-28"
              />
              {lines.length > 1 && (
                <button type="button" onClick={() => removeLine(i)} className="mb-2 shrink-0 text-muted hover:text-danger">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-accent hover:underline">
            <Plus size={12} /> Add line
          </button>
        </div>

        <div>
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
