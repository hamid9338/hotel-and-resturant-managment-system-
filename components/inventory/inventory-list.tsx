"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { usePermissions } from "@/components/permissions-provider";
import { InventoryItemModal } from "@/components/inventory/inventory-item-modal";

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
  supplier: Supplier | null;
};

export function InventoryList() {
  const { has } = usePermissions();
  const [items, setItems] = useState<Item[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ item: Item | null } | null>(null);

  const load = useCallback(() => {
    api
      .get<Item[]>("/api/inventory")
      .then(setItems)
      .catch(() => setItems([]));
    api
      .get<Supplier[]>("/api/suppliers")
      .then(setSuppliers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) return <SkeletonRows rows={6} />;

  const filtered = items.filter(
    (i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" className="w-48 pl-8" />
          </div>
          {has("inventory.manage") && (
            <Button variant="primary" onClick={() => setModal({ item: null })}>
              + Item
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="No inventory items" description="Add your first stock item to get started." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Reorder At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const low = Number(i.quantityOnHand) <= Number(i.reorderLevel);
                  return (
                    <tr
                      key={i.id}
                      onClick={() => setModal({ item: i })}
                      className="cursor-pointer border-b border-border-default last:border-0 hover:bg-surface-2/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{i.name}</div>
                        <div className="font-mono text-xs text-muted">{i.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-muted">{i.category ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{i.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {i.quantityOnHand} {i.unit}
                        {low && (
                          <Badge tone="danger" className="ml-2">
                            Low
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">
                        {i.reorderLevel} {i.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modal && (
        <InventoryItemModal
          item={modal.item}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
