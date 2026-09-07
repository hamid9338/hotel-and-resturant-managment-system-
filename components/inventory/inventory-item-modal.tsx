"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";

type Supplier = { id: string; name: string };
type Item = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  quantityOnHand: string;
  reorderLevel: string;
  costPerUnit: string | null;
  supplierId: string | null;
};

export function InventoryItemModal({
  item,
  suppliers,
  onClose,
  onDone,
}: {
  item: Item | null;
  suppliers: Supplier[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { has } = usePermissions();
  const [sku, setSku] = useState(item?.sku ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [reorderLevel, setReorderLevel] = useState(item?.reorderLevel ?? "0");
  const [costPerUnit, setCostPerUnit] = useState(item?.costPerUnit ?? "");
  const [supplierId, setSupplierId] = useState(item?.supplierId ?? "");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body = {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim() || undefined,
        unit: unit.trim(),
        reorderLevel: Number(reorderLevel) || 0,
        costPerUnit: costPerUnit ? Number(costPerUnit) : undefined,
        supplierId: supplierId || undefined,
      };
      if (item) {
        await api.patch(`/api/inventory/${item.id}`, body);
      } else {
        await api.post("/api/inventory", body);
      }
      toast.success(item ? "Item updated" : "Item created");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save item.");
    } finally {
      setLoading(false);
    }
  };

  const submitAdjustment = async () => {
    if (!item) return;
    setAdjusting(true);
    try {
      await api.post(`/api/inventory/${item.id}/adjust`, {
        quantityDelta: Number(adjustDelta),
        reason: adjustReason.trim(),
      });
      toast.success("Stock adjusted");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not adjust stock.");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <Modal
      title={item ? `Edit ${item.name}` : "New Inventory Item"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!sku.trim() || !name.trim() || !unit.trim()}
            onClick={submit}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {item && (
          <div className="rounded-lg border border-border-default bg-surface-2 px-3 py-2 text-sm">
            On hand: <span className="font-mono font-medium">{item.quantityOnHand}</span> {unit}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} disabled={!!item} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pcs, ltr..." />
          </div>
        </div>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Cost / Unit</Label>
            <Input type="number" min={0} value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Reorder Level</Label>
            <Input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          </div>
          <div>
            <Label>Supplier</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {item && has("inventory.adjust_stock") && (
          <div className="border-t border-border-default pt-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Manual Stock Adjustment</div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="+/- quantity"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="Reason (required)"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                loading={adjusting}
                disabled={!Number(adjustDelta) || adjustReason.trim().length < 3}
                onClick={submitAdjustment}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
