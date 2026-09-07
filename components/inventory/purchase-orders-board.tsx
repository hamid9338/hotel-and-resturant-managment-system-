"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { CreatePurchaseOrderModal } from "@/components/inventory/create-purchase-order-modal";
import { ReceivePurchaseOrderModal } from "@/components/inventory/receive-purchase-order-modal";

type Supplier = { id: string; name: string };
type InventoryItemRef = { id: string; name: string; unit: string };
type POItem = {
  id: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
  inventoryItem: InventoryItemRef;
};
type PO = {
  id: string;
  status: string;
  total: string;
  notes: string | null;
  createdAt: string;
  supplier: Supplier;
  items: POItem[];
  createdBy: { name: string };
};

const STATUS_TONE: Record<string, "neutral" | "warning" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  ORDERED: "warning",
  PARTIALLY_RECEIVED: "info",
  RECEIVED: "success",
  VERIFIED: "success",
  PAID: "success",
  CANCELLED: "danger",
};
const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "ORDERED",
  ORDERED: null, // receiving is its own action, not this generic transition
  RECEIVED: "VERIFIED",
  VERIFIED: "PAID",
};

export function PurchaseOrdersBoard({ currency }: { currency: string }) {
  const toast = useToast();
  const { has } = usePermissions();
  const [orders, setOrders] = useState<PO[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItemRef[]>([]);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<PO | null>(null);

  const load = useCallback(() => {
    api
      .get<PO[]>("/api/purchase-orders")
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    load();
    api.get<Supplier[]>("/api/suppliers").then(setSuppliers).catch(() => {});
    api.get<InventoryItemRef[]>("/api/inventory").then(setItems).catch(() => {});
  }, [load]);

  const advance = async (po: PO) => {
    const next = NEXT_STATUS[po.status];
    if (!next) return;
    try {
      await api.patch(`/api/purchase-orders/${po.id}`, { status: next });
      toast.success(`Purchase order → ${next}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update purchase order.");
    }
  };

  const cancel = async (po: PO) => {
    try {
      await api.patch(`/api/purchase-orders/${po.id}`, { status: "CANCELLED" });
      toast.success("Purchase order cancelled");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel purchase order.");
    }
  };

  if (orders === null) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Purchase Orders</h1>
        {has("inventory.manage") && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Purchase Order
          </Button>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No purchase orders" description="Create one to start ordering stock from a supplier." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {orders.map((po) => (
            <div key={po.id} className="rounded-xl border border-border-default bg-surface-1 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{po.supplier.name}</span>
                <Badge tone={STATUS_TONE[po.status]}>{po.status.replace(/_/g, " ")}</Badge>
              </div>
              <ul className="mb-3 space-y-1 text-sm text-muted">
                {po.items.map((line) => (
                  <li key={line.id} className="flex justify-between">
                    <span>{line.inventoryItem.name}</span>
                    <span className="font-mono text-xs">
                      {line.quantityReceived}/{line.quantityOrdered} {line.inventoryItem.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <span>
                  {formatDateTime(po.createdAt)} · {po.createdBy.name}
                </span>
                <span className="font-mono">{formatCurrency(Number(po.total), currency)}</span>
              </div>
              {has("inventory.manage") && (
                <div className="flex flex-wrap gap-2">
                  {(po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED") && (
                    <Button size="sm" variant="primary" onClick={() => setReceiving(po)}>
                      Receive Delivery
                    </Button>
                  )}
                  {NEXT_STATUS[po.status] && (
                    <Button size="sm" variant="secondary" onClick={() => advance(po)}>
                      → {NEXT_STATUS[po.status]}
                    </Button>
                  )}
                  {!["PAID", "CANCELLED", "RECEIVED", "PARTIALLY_RECEIVED", "VERIFIED"].includes(po.status) && (
                    <Button size="sm" variant="danger" onClick={() => cancel(po)}>
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreatePurchaseOrderModal
          suppliers={suppliers}
          items={items}
          currency={currency}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {receiving && (
        <ReceivePurchaseOrderModal
          po={receiving}
          onClose={() => setReceiving(null)}
          onDone={() => {
            setReceiving(null);
            load();
          }}
        />
      )}
    </div>
  );
}
