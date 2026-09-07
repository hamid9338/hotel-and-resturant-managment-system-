"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDateTime } from "@/lib/format";

type OrderItemRow = { id: string; nameSnapshot: string; qty: number };
type Order = {
  id: string;
  orderType: string;
  status: string;
  total: string;
  createdAt: string;
  table: { label: string } | null;
  items: OrderItemRow[];
  createdBy: { name: string };
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: null,
  BILLED: null,
  CANCELLED: null,
};
const STATUS_TONE: Record<string, "warning" | "info" | "accent" | "success" | "neutral" | "danger"> = {
  PENDING: "warning",
  PREPARING: "info",
  READY: "accent",
  SERVED: "success",
  BILLED: "neutral",
  CANCELLED: "danger",
};

export function OrdersBoard({ currency }: { currency: string }) {
  const toast = useToast();
  const { has } = usePermissions();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState("active");

  const load = useCallback(() => {
    api
      .get<Order[]>("/api/orders")
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const advance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: next });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update order.");
    }
  };

  const cancel = async (order: Order) => {
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: "CANCELLED" });
      toast.success("Order cancelled");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel order.");
    }
  };

  const bill = async (order: Order) => {
    try {
      await api.post(`/api/orders/${order.id}/bill`, { paymentMethod: "CASH" });
      toast.success("Order billed");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not bill order.");
    }
  };

  if (orders === null) return <SkeletonRows rows={6} />;

  const visible = filter === "active" ? orders.filter((o) => !["BILLED", "CANCELLED"].includes(o.status)) : orders;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <div className="flex gap-1 rounded-lg border border-border-default bg-surface-2 p-1">
          <button
            onClick={() => setFilter("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === "active" ? "bg-surface-1 text-accent shadow-sm" : "text-muted"}`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${filter === "all" ? "bg-surface-1 text-accent shadow-sm" : "text-muted"}`}
          >
            All (last 100)
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No orders" description="Orders placed from the POS will show up here." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <div key={order.id} className="rounded-xl border border-border-default bg-surface-1 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium">{order.table ? order.table.label : order.orderType.replace("_", " ")}</span>
                <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
              </div>
              <ul className="mb-3 space-y-1 text-sm text-muted">
                {order.items.map((i) => (
                  <li key={i.id}>
                    {i.qty}× {i.nameSnapshot}
                  </li>
                ))}
              </ul>
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <span>
                  {formatDateTime(order.createdAt)} · {order.createdBy.name}
                </span>
                <span className="font-mono">{formatCurrency(Number(order.total), currency)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {has("restaurant.update_order_status") && NEXT_STATUS[order.status] && (
                  <Button size="sm" variant="secondary" onClick={() => advance(order)}>
                    → {NEXT_STATUS[order.status]}
                  </Button>
                )}
                {has("restaurant.bill_order") && !["BILLED", "CANCELLED"].includes(order.status) && (
                  <Button size="sm" variant="primary" onClick={() => bill(order)}>
                    Bill
                  </Button>
                )}
                {has("restaurant.cancel_order") && !["BILLED", "CANCELLED"].includes(order.status) && (
                  <Button size="sm" variant="danger" onClick={() => cancel(order)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
