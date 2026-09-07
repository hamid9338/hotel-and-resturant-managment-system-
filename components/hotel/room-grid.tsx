"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, BedDouble } from "lucide-react";
import { api } from "@/lib/api-client";
import { RoomCard } from "@/components/hotel/room-card";
import { RoomDetailModal } from "@/components/hotel/room-detail-modal";
import { NewReservationModal } from "@/components/hotel/new-reservation-modal";
import { CheckoutModal } from "@/components/hotel/checkout-modal";
import { DiscountModal } from "@/components/hotel/discount-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/field";
import type { RoomWithBookings } from "@/lib/types/hotel";

type ModalState =
  | { type: "detail"; room: RoomWithBookings }
  | { type: "new"; room: RoomWithBookings }
  | { type: "checkout"; bookingId: string }
  | { type: "discount"; bookingId: string }
  | null;

const STATUS_FILTERS = ["ALL", "AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"];

export function RoomGrid({ currency }: { currency: string }) {
  const [rooms, setRooms] = useState<RoomWithBookings[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(() => {
    api
      .get<RoomWithBookings[]>("/api/rooms")
      .then(setRooms)
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshAndClose = () => {
    load();
    setModal(null);
  };

  const filtered = (rooms ?? []).filter(
    (r) => (statusFilter === "ALL" || r.status === statusFilter) && r.number.includes(search)
  );

  if (rooms === null) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Rooms</h1>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room #"
            className="w-36 pl-8"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              statusFilter === s
                ? "border-accent-border bg-accent-soft text-accent"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BedDouble} title="No rooms match" description="Try a different filter or search." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filtered.map((room) => (
            <RoomCard key={room.id} room={room} currency={currency} onClick={() => setModal({ type: "detail", room })} />
          ))}
        </div>
      )}

      {modal?.type === "detail" && (
        <RoomDetailModal
          room={modal.room}
          currency={currency}
          onClose={() => setModal(null)}
          onChanged={load}
          onNewReservation={() => setModal({ type: "new", room: modal.room })}
          onCheckout={(bookingId) => setModal({ type: "checkout", bookingId })}
          onDiscount={(bookingId) => setModal({ type: "discount", bookingId })}
        />
      )}
      {modal?.type === "new" && (
        <NewReservationModal room={modal.room} currency={currency} onClose={() => setModal(null)} onCreated={refreshAndClose} />
      )}
      {modal?.type === "checkout" && (
        <CheckoutModal bookingId={modal.bookingId} currency={currency} onClose={() => setModal(null)} onDone={refreshAndClose} />
      )}
      {modal?.type === "discount" && (
        <DiscountModal bookingId={modal.bookingId} onClose={() => setModal(null)} onDone={refreshAndClose} />
      )}
    </div>
  );
}
