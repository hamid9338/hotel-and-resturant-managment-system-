"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { fetchWithCache } from "@/lib/offline/data-cache";
import { getPendingOperations, type QueuedOperation } from "@/lib/offline/outbox";
import { useSessionUser } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDateTime, formatRelativeTime } from "@/lib/format";
import { BillOrderModal } from "@/components/restaurant/bill-order-modal";
import { AddOrderItemsModal } from "@/components/restaurant/add-order-items-modal";
import { RefundModal } from "@/components/shared/refund-modal";

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

type ModalState =
  | { type: "bill"; order: Order }
  | { type: "refund"; order: Order }
  | { type: "addItems"; order: Order }
  | null;

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
  const { id: userId } = useSessionUser();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [pendingOrders, setPendingOrders] = useState<QueuedOperation[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{ cachedAt: string; stale: boolean } | null>(null);
  const [filter, setFilter] = useState("active");
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(() => {
    fetchWithCache("/api/orders", () => api.get<Order[]>("/api/orders"))
      .then(({ data, cachedAt, stale }) => {
        setOrders(data);
        setCacheInfo({ cachedAt, stale });
      })
      .catch(() => setOrders([]));
    // Not yet synced (still in this device's own local outbox), so it
    // doesn't exist server-side yet — merged in separately below, clearly
    // marked, rather than silently invisible until the next sync succeeds.
    getPendingOperations(userId)
      .then((ops) => setPendingOrders(ops.filter((op) => op.operationKind === "orders.create")))
      .catch(() => setPendingOrders([]));
  }, [userId]);

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

  const refreshAndClose = () => {
    load();
    setModal(null);
  };

  if (orders === null) return <SkeletonRows rows={6} />;

  const visible = filter === "active" ? orders.filter((o) => !["BILLED", "CANCELLED"].includes(o.status)) : orders;

  return (
    <div className="space-y-4">
      {cacheInfo?.stale && (
        <Badge tone="warning">Showing data from {formatRelativeTime(cacheInfo.cachedAt)} — offline</Badge>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/orders?format=csv">
            <Button size="sm" variant="secondary">
              <Download size={13} /> Export CSV
            </Button>
          </a>
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
      </div>

      {pendingOrders.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pendingOrders.map((op) => {
            const payload = op.payload as { displayLabel?: string; displayTable?: string | null; displayItems?: { name: string; qty: number }[] };
            return (
              <div key={op.id} className="rounded-xl border border-dashed border-warning/40 bg-warning-soft/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{payload.displayTable ?? payload.displayLabel ?? "Order"}</span>
                  <Badge tone="warning">Pending Sync</Badge>
                </div>
                <ul className="mb-3 space-y-1 text-sm text-muted">
                  {(payload.displayItems ?? []).map((i, idx) => (
                    <li key={idx}>
                      {i.qty}× {i.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">
                  Placed offline — will appear here properly and reach the kitchen once back online.
                </p>
              </div>
            );
          })}
        </div>
      )}

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
                {has("restaurant.create_order") && !["BILLED", "CANCELLED"].includes(order.status) && (
                  <Button size="sm" variant="secondary" onClick={() => setModal({ type: "addItems", order })}>
                    Add Items
                  </Button>
                )}
                {has("restaurant.bill_order") && !["BILLED", "CANCELLED"].includes(order.status) && (
                  <Button size="sm" variant="primary" onClick={() => setModal({ type: "bill", order })}>
                    Bill
                  </Button>
                )}
                {has("restaurant.cancel_order") && !["BILLED", "CANCELLED"].includes(order.status) && (
                  <Button size="sm" variant="danger" onClick={() => cancel(order)}>
                    Cancel
                  </Button>
                )}
                {order.status !== "CANCELLED" && (
                  <a
                    href={`/print/order/${order.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                  >
                    {order.status === "BILLED" ? "Print Receipt" : "Print Ticket"}
                  </a>
                )}
                {has("finance.refund") && order.status === "BILLED" && (
                  <Button size="sm" variant="ghost" onClick={() => setModal({ type: "refund", order })}>
                    Refund
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.type === "bill" && (
        <BillOrderModal
          orderId={modal.order.id}
          total={Number(modal.order.total)}
          currency={currency}
          onClose={() => setModal(null)}
          onDone={refreshAndClose}
        />
      )}
      {modal?.type === "refund" && (
        <RefundModal entityType="order" entityId={modal.order.id} onClose={() => setModal(null)} onDone={refreshAndClose} />
      )}
      {modal?.type === "addItems" && (
        <AddOrderItemsModal
          orderId={modal.order.id}
          currency={currency}
          onClose={() => setModal(null)}
          onDone={refreshAndClose}
        />
      )}
    </div>
  );
}
