"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { submitOrQueue } from "@/lib/offline/sync-client";
import { useSessionUser } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";
import type { RoomWithBookings } from "@/lib/types/hotel";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

export function NewReservationModal({
  room,
  currency,
  onClose,
  onCreated,
}: {
  room: RoomWithBookings;
  currency: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { id: userId } = useSessionUser();
  const [form, setForm] = useState({
    guestName: "",
    cnic: "",
    phone: "",
    address: "",
    checkIn: todayStr(),
    checkOut: tomorrowStr(),
    advancePaid: "",
    paymentMethod: "CASH",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nights = Math.max(
    1,
    Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000)
  );
  const estimate = nights * Number(room.roomType.basePrice);

  const submit = async () => {
    setError("");
    setLoading(true);
    const payload = {
      roomId: room.id,
      guestName: form.guestName,
      cnic: form.cnic || undefined,
      phone: form.phone,
      address: form.address || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      advancePaid: form.advancePaid ? Number(form.advancePaid) : 0,
      paymentMethod: form.paymentMethod,
      notes: form.notes || undefined,
    };
    try {
      const { queued } = await submitOrQueue({
        operationKind: "bookings.create",
        entityId: crypto.randomUUID(),
        userId,
        payload,
        onlineCall: () => api.post("/api/bookings", payload),
      });
      toast.success(
        queued
          ? `You're offline — this reservation for Room ${room.number} will sync automatically once you're back online.`
          : `Reservation created for Room ${room.number}`
      );
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the reservation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`New Reservation — Room ${room.number}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={loading} disabled={!form.guestName || !form.phone}>
            Create Reservation
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label required>Guest Name</Label>
          <Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
        </div>
        <div>
          <Label>CNIC</Label>
          <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="42101-1234567-1" />
        </div>
        <div>
          <Label required>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <Label required>Check-in</Label>
          <Input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
        </div>
        <div>
          <Label required>Check-out</Label>
          <Input
            type="date"
            value={form.checkOut}
            min={form.checkIn}
            onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
          />
        </div>
        <div>
          <Label>Advance Paid</Label>
          <Input
            type="number"
            min={0}
            value={form.advancePaid}
            onChange={(e) => setForm({ ...form, advancePaid: e.target.value })}
          />
        </div>
        <div>
          <Label>Payment Method</Label>
          <Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
            <option value="CASH">Cash</option>
            <option value="EASYPAISA">Easypaisa</option>
            <option value="JAZZCASH">JazzCash</option>
            <option value="BANK">Bank</option>
            <option value="CARD">Card</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm">
        <span className="text-muted">{nights} night(s) estimate: </span>
        <span className="font-mono font-medium">{formatCurrency(estimate, currency)}</span>
        <span className="text-muted"> + tax</span>
      </div>
      <FieldError>{error}</FieldError>
    </Modal>
  );
}
