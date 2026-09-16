"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import type { MenuCategory, MenuItemRow } from "@/components/restaurant/menu-management";

export function MenuItemModal({
  item,
  categories,
  onClose,
  onDone,
}: {
  item: MenuItemRow | null;
  categories: MenuCategory[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(item?.price ?? "");
  const [cost, setCost] = useState(item?.cost ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [prepTimeMins, setPrepTimeMins] = useState(item?.prepTimeMins ? String(item.prepTimeMins) : "");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        categoryId,
        price: Number(price),
        cost: cost ? Number(cost) : undefined,
        description: description.trim() || undefined,
        prepTimeMins: prepTimeMins ? Number(prepTimeMins) : undefined,
        available,
      };
      if (item) {
        await api.patch(`/api/menu/${item.id}`, body);
      } else {
        await api.post("/api/menu", body);
      }
      toast.success(item ? "Item updated" : "Item created");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={item ? `Edit ${item.name}` : "New Menu Item"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!name.trim() || !categoryId || !(Number(price) > 0)}
            onClick={submit}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label required>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label required>Category</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label required>Price</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cost</Label>
            <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div>
            <Label>Prep Time (mins)</Label>
            <Input type="number" min={0} value={prepTimeMins} onChange={(e) => setPrepTimeMins(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
          Available on the POS
        </label>
      </div>
    </Modal>
  );
}
