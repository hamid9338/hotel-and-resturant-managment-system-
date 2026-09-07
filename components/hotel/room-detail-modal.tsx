"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/components/permissions-provider";
import { formatCurrency, formatDate } from "@/lib/format";
import type { RoomWithBookings } from "@/lib/types/hotel";

const ROOM_STATUS_OPTIONS = ["AVAILABLE", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"];

export function RoomDetailModal({
  room,
  currency,
  onClose,
  onChanged,
  onNewReservation,
  onCheckout,
  onDiscount,
}: {
  room: RoomWithBookings;
  currency: string;
  onClose: () => void;
  onChanged: () => void;
  onNewReservation: () => void;
  onCheckout: (bookingId: string) => void;
  onDiscount: (bookingId: string) => void;
}) {
  const toast = useToast();
  const { has } = usePermissions();
  const [busy, setBusy] = useState(false);

  const checkIn = async (bookingId: string) => {
    setBusy(true);
    try {
      await api.post(`/api/bookings/${bookingId}/checkin`);
      toast.success("Guest checked in");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not check in.");
    } finally {
      setBusy(false);
    }
  };

  const cancelReservation = async (bookingId: string) => {
    setBusy(true);
    try {
      await api.post(`/api/bookings/${bookingId}/cancel`);
      toast.success("Reservation cancelled");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    setBusy(true);
    try {
      await api.patch(`/api/rooms/${room.id}/status`, { status });
      toast.success(`Room ${room.number} → ${status.replace(/_/g, " ")}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Room ${room.number}`}
      onClose={onClose}
      wide
      footer={
        has("hotel.create_booking") ? (
          <Button variant="primary" onClick={onNewReservation}>
            + New Reservation
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted">
          {room.roomType.name} · Floor {room.floor} · <Badge>{room.status.replace(/_/g, " ")}</Badge>
        </div>

        {room.activeBooking && (
          <div className="rounded-lg border border-accent-border bg-accent-soft p-4">
            <div className="mb-2 font-medium">Current Stay — {room.activeBooking.guest.name}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted">
              <div>Check-in: {formatDate(room.activeBooking.checkIn)}</div>
              <div>Check-out: {formatDate(room.activeBooking.checkOut)}</div>
              <div>Total: {formatCurrency(Number(room.activeBooking.total), currency)}</div>
              <div>Balance Due: {formatCurrency(Number(room.activeBooking.balanceDue), currency)}</div>
            </div>
            <div className="mt-3 flex gap-2">
              {has("hotel.checkout") && (
                <Button size="sm" variant="primary" onClick={() => onCheckout(room.activeBooking!.id)}>
                  Check Out
                </Button>
              )}
              {has("hotel.discount") && (
                <Button size="sm" variant="secondary" onClick={() => onDiscount(room.activeBooking!.id)}>
                  Apply Discount
                </Button>
              )}
            </div>
          </div>
        )}

        {room.upcomingBookings.length > 0 && (
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">Upcoming Reservations</div>
            <div className="space-y-2">
              {room.upcomingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{b.guest.name}</div>
                    <div className="text-xs text-muted">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {has("hotel.checkin") && (
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => checkIn(b.id)}>
                        Check In
                      </Button>
                    )}
                    {has("hotel.cancel_booking") && (
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => cancelReservation(b.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!room.activeBooking && room.upcomingBookings.length === 0 && (
          <p className="text-sm text-muted">No current or upcoming reservations for this room.</p>
        )}

        {has("hotel.update_room_status") && (
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">Room Status</div>
            <div className="flex flex-wrap gap-2">
              {ROOM_STATUS_OPTIONS.filter((s) => s !== room.status).map((s) => (
                <Button key={s} size="sm" variant="secondary" disabled={busy} onClick={() => setStatus(s)}>
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
