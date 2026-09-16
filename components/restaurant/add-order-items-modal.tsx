"use client";

import { useEffect, useState } from "react";
import { Search, Plus, Minus } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { fetchWithCache } from "@/lib/offline/data-cache";
import { submitOrQueue } from "@/lib/offline/sync-client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

type MenuItem = { id: string; name: string; price: string; available: boolean };
type CartLine = { menuItemId: string; name: string; price: number; qty: number };

export function AddOrderItemsModal({
  orderId,
  currency,
  onClose,
  onDone,
}: {
  orderId: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { id: userId } = useSessionUser();
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWithCache("/api/menu", () => api.get<MenuItem[]>("/api/menu"))
      .then(({ data }) => setMenu(data))
      .catch(() => setMenu([]));
  }, []);

  const filteredMenu = (menu ?? []).filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) return prev.map((l) => (l.menuItemId === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.menuItemId !== menuItemId) return [l];
        const qty = l.qty + delta;
        return qty <= 0 ? [] : [{ ...l, qty }];
      })
    );
  };

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async () => {
    setSubmitting(true);
    const payload = {
      orderId,
      items: cart.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
    };
    try {
      const { queued } = await submitOrQueue({
        operationKind: "orders.addItems",
        entityId: crypto.randomUUID(),
        userId,
        payload,
        onlineCall: () => api.post(`/api/orders/${orderId}/items`, { items: payload.items }),
      });
      toast.success(
        queued ? "You're offline — these items will sync automatically once you're back online." : "Items added"
      );
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add items.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Add Items"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={submitting} disabled={cart.length === 0}>
            Add {cart.length > 0 ? formatCurrency(subtotal, currency) : ""}
          </Button>
        </>
      }
    >
      {menu === null ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu" className="pl-8" />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => item.available && addToCart(item)}
                disabled={!item.available}
                className="flex flex-col items-start gap-1 rounded-lg border border-border-default bg-surface-1 p-2.5 text-left transition-colors hover:border-accent-border disabled:opacity-40"
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="font-mono text-xs text-muted">{formatCurrency(Number(item.price), currency)}</span>
              </button>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border-default bg-surface-2 p-3">
              {cart.map((line) => (
                <div key={line.menuItemId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{line.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(line.menuItemId, -1)}
                      className="rounded bg-surface-3 p-1 text-muted hover:text-foreground"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center font-mono text-xs">{line.qty}</span>
                    <button
                      onClick={() => updateQty(line.menuItemId, 1)}
                      className="rounded bg-surface-3 p-1 text-muted hover:text-foreground"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
