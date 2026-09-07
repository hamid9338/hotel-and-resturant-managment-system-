"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarRange, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatCurrency, formatDate } from "@/lib/format";
import { usePermissions } from "@/components/permissions-provider";
import { RefundModal } from "@/components/shared/refund-modal";

type BookingRow = {
  id: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  total: string;
  balanceDue: string;
  status: string;
  guest: { name: string };
  room: { number: string; roomType: { name: string } };
};

const STATUS_TONE: Record<string, "success" | "accent" | "neutral" | "danger" | "warning"> = {
  RESERVED: "warning",
  CHECKED_IN: "accent",
  CHECKED_OUT: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
};

const STATUS_FILTERS = ["ALL", "RESERVED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"];

export function BookingsTable({ currency }: { currency: string }) {
  const { has } = usePermissions();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = status !== "ALL" ? `?status=${status}` : "";
    api
      .get<BookingRow[]>(`/api/bookings${qs}`)
      .then(setBookings)
      .catch(() => setBookings([]));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (bookings ?? []).filter(
    (b) => b.guest.name.toLowerCase().includes(search.toLowerCase()) || b.room.number.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Reservations</h1>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest or room"
            className="w-48 pl-8"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              status === s
                ? "border-accent-border bg-accent-soft text-accent"
                : "border-border-default text-muted hover:text-foreground"
            }`}
          >
            {s === "ALL" ? "All" : s.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {bookings === null ? (
        <SkeletonRows rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No reservations found" description="Try a different filter or search." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left font-mono text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-border-default last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3 font-medium">{b.guest.name}</td>
                    <td className="px-4 py-3 text-muted">
                      {b.room.number} · {b.room.roomType.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDate(b.checkIn)} → {formatDate(b.checkOut)} ({b.nights}n)
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(b.total), currency)}</td>
                    <td className="px-4 py-3 text-right font-mono text-danger">
                      {Number(b.balanceDue) > 0 ? formatCurrency(Number(b.balanceDue), currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status === "CHECKED_OUT" && (
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/print/booking/${b.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                          >
                            Print
                          </a>
                          {has("finance.refund") && (
                            <Button size="sm" variant="ghost" onClick={() => setRefundingId(b.id)}>
                              Refund
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {refundingId && (
        <RefundModal
          entityType="booking"
          entityId={refundingId}
          onClose={() => setRefundingId(null)}
          onDone={() => {
            setRefundingId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
