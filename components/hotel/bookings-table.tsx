"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarRange, Search, Download } from "lucide-react";
import { api } from "@/lib/api-client";
import { fetchWithCache } from "@/lib/offline/data-cache";
import { getPendingOperations, type QueuedOperation } from "@/lib/offline/outbox";
import { useSessionUser } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format";
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
  const { id: userId } = useSessionUser();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [pendingBookings, setPendingBookings] = useState<QueuedOperation[]>([]);
  const [cacheInfo, setCacheInfo] = useState<{ cachedAt: string; stale: boolean } | null>(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = status !== "ALL" ? `?status=${status}` : "";
    const path = `/api/bookings${qs}`;
    fetchWithCache(path, () => api.get<BookingRow[]>(path))
      .then(({ data, cachedAt, stale }) => {
        setBookings(data);
        setCacheInfo({ cachedAt, stale });
      })
      .catch(() => setBookings([]));
    // Not yet synced (still in this device's own local outbox), so it isn't
    // in the database yet — merged in separately below rather than silently
    // invisible until the next successful sync.
    getPendingOperations(userId)
      .then((ops) => setPendingBookings(ops.filter((op) => op.operationKind === "bookings.create")))
      .catch(() => setPendingBookings([]));
  }, [status, userId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = (bookings ?? []).filter(
    (b) => b.guest.name.toLowerCase().includes(search.toLowerCase()) || b.room.number.includes(search)
  );

  // Deliberately an early return (not a ternary branch inside the JSX below)
  // — a ternary here that swaps the loading skeleton for the loaded table
  // inside the same return statement leaves the DOM permanently stuck on
  // the server-rendered skeleton in this Next.js version (confirmed via a
  // clean-build, production-mode repro: identical logic, only moving this
  // check into a same-return ternary reproduces it). Every other list page
  // in this app already uses this early-return shape for the same reason.
  if (bookings === null) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-4">
      {cacheInfo?.stale && (
        <Badge tone="warning">Showing data from {formatRelativeTime(cacheInfo.cachedAt)} — offline</Badge>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Reservations</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest or room"
              className="w-48 pl-8"
            />
          </div>
          <a href={`/api/bookings?format=csv${status !== "ALL" ? `&status=${status}` : ""}`}>
            <Button size="sm" variant="secondary">
              <Download size={13} /> Export CSV
            </Button>
          </a>
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

      {pendingBookings.length > 0 && (
        <Card className="border-dashed border-warning/40 bg-warning-soft/30">
          <div className="divide-y divide-border-default">
            {pendingBookings.map((op) => {
              const payload = op.payload as { guestName?: string; displayRoomNumber?: string; checkIn?: string; checkOut?: string };
              return (
                <div key={op.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{payload.guestName ?? "Reservation"}</div>
                    <div className="text-xs text-muted">
                      {payload.displayRoomNumber ? `Room ${payload.displayRoomNumber}` : "Room pending"}
                      {payload.checkIn && payload.checkOut ? ` · ${payload.checkIn} → ${payload.checkOut}` : ""}
                    </div>
                  </div>
                  <Badge tone="warning">Pending Sync</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
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
