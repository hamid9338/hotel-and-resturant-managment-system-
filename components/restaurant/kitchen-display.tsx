"use client";

import { useEffect, useState, useCallback } from "react";
import { ChefHat } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

type OrderItemRow = { id: string; nameSnapshot: string; qty: number; status: string | null };
type Order = {
  id: string;
  orderType: string;
  status: string;
  createdAt: string;
  table: { label: string } | null;
  items: OrderItemRow[];
};

const NEXT_ITEM_STATUS: Record<string, string> = {
  QUEUED: "COOKING",
  COOKING: "READY",
  READY: "SERVED",
};
const ITEM_STATUS_TONE: Record<string, "neutral" | "warning" | "info" | "success"> = {
  QUEUED: "neutral",
  COOKING: "warning",
  READY: "success",
  SERVED: "success",
};

export function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  const load = useCallback(() => {
    api
      .get<Order[]>("/api/orders")
      .then((all) => setOrders(all.filter((o) => ["PENDING", "PREPARING", "READY"].includes(o.status))))
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const advanceItem = async (orderId: string, item: OrderItemRow) => {
    const next = NEXT_ITEM_STATUS[item.status ?? "QUEUED"];
    if (!next) return;
    try {
      await api.patch(`/api/orders/${orderId}/items/${item.id}/status`, { status: next });
      load();
    } catch (err) {
      if (err instanceof ApiError) return; // stale-order race — next poll self-corrects
    }
  };

  if (orders === null) return <SkeletonRows rows={6} />;

  const activeOrders = orders
    .filter((o) => o.items.some((i) => i.status !== "SERVED"))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">Kitchen Display</h1>

      {activeOrders.length === 0 ? (
        <EmptyState icon={ChefHat} title="All caught up" description="No orders waiting on the kitchen." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activeOrders.map((order) => (
            <div key={order.id} className="rounded-xl border border-border-default bg-surface-1 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{order.table ? order.table.label : order.orderType.replace("_", " ")}</span>
                <span className="text-xs text-muted">{formatDateTime(order.createdAt)}</span>
              </div>
              <ul className="space-y-1.5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {item.qty}× {item.nameSnapshot}
                    </span>
                    <button
                      onClick={() => advanceItem(order.id, item)}
                      disabled={!NEXT_ITEM_STATUS[item.status ?? "QUEUED"]}
                      className="shrink-0"
                    >
                      <Badge tone={ITEM_STATUS_TONE[item.status ?? "QUEUED"]}>{item.status ?? "QUEUED"}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
