"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import type { MenuItemRow } from "@/components/restaurant/menu-management";

type InventoryItem = { id: string; name: string; unit: string };
type RecipeLineRow = { inventoryItem: { id: string; name: string; unit: string }; quantityUsed: string };
type DraftLine = { inventoryItemId: string; quantityUsed: string };

export function RecipeEditorModal({
  menuItem,
  onClose,
  onDone,
}: {
  menuItem: MenuItemRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [ingredients, setIngredients] = useState<InventoryItem[] | null>(null);
  const [lines, setLines] = useState<DraftLine[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<InventoryItem[]>("/api/inventory"),
      api.get<RecipeLineRow[]>(`/api/menu/${menuItem.id}/recipe`),
    ])
      .then(([inv, recipe]) => {
        setIngredients(inv);
        setLines(recipe.map((r) => ({ inventoryItemId: r.inventoryItem.id, quantityUsed: r.quantityUsed })));
      })
      .catch(() => {
        setIngredients([]);
        setLines([]);
      });
  }, [menuItem.id]);

  const addLine = () => {
    if (!ingredients || ingredients.length === 0) return;
    setLines((prev) => [...(prev ?? []), { inventoryItemId: ingredients[0].id, quantityUsed: "" }]);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((prev) => (prev ?? []).map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev ?? []).filter((_, i) => i !== index));
  };

  const unitFor = (inventoryItemId: string) => ingredients?.find((i) => i.id === inventoryItemId)?.unit ?? "";

  const submit = async () => {
    setSaving(true);
    try {
      await api.put(`/api/menu/${menuItem.id}/recipe`, {
        lines: (lines ?? [])
          .filter((l) => l.inventoryItemId && Number(l.quantityUsed) > 0)
          .map((l) => ({ inventoryItemId: l.inventoryItemId, quantityUsed: Number(l.quantityUsed) })),
      });
      toast.success("Recipe saved");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save recipe.");
    } finally {
      setSaving(false);
    }
  };

  const allLinesValid = (lines ?? []).every((l) => l.inventoryItemId && Number(l.quantityUsed) > 0);

  return (
    <Modal
      title={`Recipe — ${menuItem.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={lines === null || !allLinesValid} onClick={submit}>
            Save Recipe
          </Button>
        </>
      }
    >
      {ingredients === null || lines === null ? (
        <SkeletonRows rows={3} />
      ) : ingredients.length === 0 ? (
        <p className="text-sm text-muted">
          No inventory items exist yet — add stock items under Inventory before defining a recipe.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Each time this dish is billed, these quantities are deducted from stock automatically.
          </p>
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={line.inventoryItemId}
                onChange={(e) => updateLine(i, { inventoryItemId: e.target.value })}
                className="flex-1"
              >
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={0}
                step="any"
                value={line.quantityUsed}
                onChange={(e) => updateLine(i, { quantityUsed: e.target.value })}
                placeholder="Qty"
                className="w-24"
              />
              <span className="w-10 text-xs text-muted">{unitFor(line.inventoryItemId)}</span>
              <button onClick={() => removeLine(i)} className="text-muted hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={addLine}>
            <Plus size={14} /> Add Ingredient
          </Button>
        </div>
      )}
    </Modal>
  );
}
