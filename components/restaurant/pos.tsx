"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import { SkeletonRows } from "@/components/ui/skeleton";

type MenuItem = {
  id: string;
  name: string;
  price: string;
  available: boolean;
  category: { id: string; name: string };
};
type TableInfo = { id: string; label: string; status: string; orders: { id: string }[] };
type OccupiedRoom = { id: string; number: string };
type CartLine = { menuItemId: string; name: string; price: number; qty: number };

const ORDER_TYPES = [
  { key: "DINE_IN", label: "Dine-in" },
  { key: "TAKEAWAY", label: "Takeaway" },
  { key: "ROOM_SERVICE", label: "Room Service" },
];

export function Pos({ currency }: { currency: string }) {
  const toast = useToast();
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [tables, setTables] = useState<TableInfo[] | null>(null);
  const [occupiedRooms, setOccupiedRooms] = useState<OccupiedRoom[]>([]);
  const [orderType, setOrderType] = useState("DINE_IN");
  const [tableId, setTableId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api.get<MenuItem[]>("/api/menu").then(setMenu).catch(() => setMenu([]));
    api.get<TableInfo[]>("/api/tables").then(setTables).catch(() => setTables([]));
  }, []);

  useEffect(() => {
    if (orderType === "ROOM_SERVICE") {
      api
        .get<OccupiedRoom[]>("/api/rooms/occupied")
        .then(setOccupiedRooms)
        .catch(() => setOccupiedRooms([]));
    }
  }, [orderType]);

  const categories = useMemo(() => ["All", ...new Set((menu ?? []).map((m) => m.category.name))], [menu]);
  const filteredMenu = (menu ?? []).filter(
    (m) => (category === "All" || m.category.name === category) && m.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const removeLine = (menuItemId: string) => setCart((prev) => prev.filter((l) => l.menuItemId !== menuItemId));

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0);
  const canPlace = cart.length > 0 && (orderType !== "DINE_IN" || tableId) && (orderType !== "ROOM_SERVICE" || roomId);

  const placeOrder = async () => {
    setPlacing(true);
    try {
      await api.post("/api/orders", {
        orderType,
        tableId: orderType === "DINE_IN" ? tableId : undefined,
        roomId: orderType === "ROOM_SERVICE" ? roomId : undefined,
        items: cart.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty })),
      });
      toast.success("Order placed");
      setCart([]);
      setTableId(null);
      api
        .get<TableInfo[]>("/api/tables")
        .then(setTables)
        .catch(() => {});
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not place order.");
    } finally {
      setPlacing(false);
    }
  };

  if (menu === null || tables === null) return <SkeletonRows rows={6} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">Point of Sale</h1>

        <div className="flex flex-wrap gap-1.5">
          {ORDER_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setOrderType(t.key);
                setTableId(null);
                setRoomId(null);
              }}
              className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                orderType === t.key
                  ? "border-accent-border bg-accent-soft text-accent"
                  : "border-border-default text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {orderType === "DINE_IN" && (
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => setTableId(t.id)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors ${
                  tableId === t.id
                    ? "border-accent-border bg-accent-soft text-accent"
                    : t.orders.length > 0
                      ? "border-warning/30 bg-warning-soft text-warning"
                      : "border-border-default text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {orderType === "ROOM_SERVICE" && (
          <Select value={roomId ?? ""} onChange={(e) => setRoomId(e.target.value || null)} className="max-w-xs">
            <option value="">Select occupied room…</option>
            {occupiedRooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number}
              </option>
            ))}
          </Select>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu" className="pl-8" />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  category === c
                    ? "border-accent-border bg-accent-soft text-accent"
                    : "border-border-default text-muted hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => item.available && addToCart(item)}
              disabled={!item.available}
              className="flex flex-col items-start gap-1 rounded-lg border border-border-default bg-surface-1 p-3 text-left transition-colors hover:border-accent-border disabled:opacity-40"
            >
              <span className="text-sm font-medium">{item.name}</span>
              <span className="font-mono text-xs text-muted">{formatCurrency(Number(item.price), currency)}</span>
              {!item.available && <span className="text-[10px] text-danger">Unavailable</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-0 lg:self-start">
        <div className="rounded-xl border border-border-default bg-surface-1">
          <div className="border-b border-border-default px-4 py-3 font-display text-[15px] font-medium">
            Current Order
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <p className="text-sm text-muted">Tap a menu item to add it.</p>
            ) : (
              cart.map((line) => (
                <div key={line.menuItemId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{line.name}</div>
                    <div className="font-mono text-xs text-muted">{formatCurrency(line.price, currency)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(line.menuItemId, -1)}
                      className="rounded bg-surface-2 p-1 text-muted hover:text-foreground"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center font-mono text-xs">{line.qty}</span>
                    <button
                      onClick={() => updateQty(line.menuItemId, 1)}
                      className="rounded bg-surface-2 p-1 text-muted hover:text-foreground"
                    >
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeLine(line.menuItemId)} className="ml-1 text-muted hover:text-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border-default p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-mono">{formatCurrency(subtotal, currency)}</span>
            </div>
            <Button variant="primary" className="w-full" disabled={!canPlace} loading={placing} onClick={placeOrder}>
              <Send size={14} /> Place Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
